require('dotenv').config({ quiet: true });

const adminAuthRoutes = require('./src/routes/admin.auth.routes');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const csrf = require('csurf');
const path = require('path');

const publicCarsRoutes = require('./src/routes/cars.public.routes');
const adminCarsRoutes = require('./src/routes/cars.admin.routes');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MIN_FORM_TIME_MS = 2000;

const allowedOrigins = [
  'https://avtozavoz19.ru',
  'https://www.avtozavoz19.ru',

  'http://localhost:3000',
  'http://127.0.0.1:3000',

  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.set('trust proxy', 1);

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.sqlite',
      dir: './prisma',
    }),

    name: 'shumdev_cms_sid',

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

// const csrfProtection = csrf();

// app.get('/api/admin/csrf-token', csrfProtection, (req, res) => {
//   res.status(200).json({
//     success: true,
//     csrfToken: req.csrfToken()
//   });
// });

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],

        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],

        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.yandex.net',
          'https://*.yandex.ru',
        ],

        fontSrc: ["'self'", 'data:'],

        connectSrc: ["'self'"],

        frameSrc: [
          "'self'",
          'https://yandex.ru',
          'https://yandex.com',
          'https://yastatic.net',
          'https://*.yandex.ru',
        ],

        objectSrc: ["'none'"],

        baseUri: ["'self'"],

        formAction: ["'self'"],

        frameAncestors: ["'none'"],

        upgradeInsecureRequests: null,
      },
    },

    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === 'null') {
        return callback(null, true);
      }

      const allowed = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',

        'http://localhost:5500',
        'http://127.0.0.1:5500',

        'https://avtozavoz19.ru',
        'https://www.avtozavoz19.ru',
      ];

      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      console.error('Blocked origin:', origin);

      return callback(new Error('CORS blocked'));
    },

    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'DELETE'],

    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

app.use((req, res, next) => {
  res.setTimeout(15000);
  next();
});

app.use('/api', publicCarsRoutes);
app.use('/api', adminAuthRoutes);
app.use('/api', adminCarsRoutes);

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const requiredEnv = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'TO_EMAIL',
  'SESSION_SECRET',
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Отсутствуют переменные окружения: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Слишком много заявок. Попробуйте чуть позже.',
  },
});

const adminLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Слишком много попыток входа. Попробуйте позже.',
  },
});

app.use('/api/admin/login', adminLoginLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AvtoZavoz server is running',
  });
});

function checkOrigin(req, res, next) {
  const origin = req.headers.origin;

  if (!origin || origin === 'null') {
    return next();
  }

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  console.error('Blocked form origin:', origin);

  return res.status(403).json({
    success: false,
    message: 'Access denied',
  });
}

app.post('/api/send', checkOrigin, sendLimiter, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Некорректный запрос.',
      });
    }

    const formTime = Number(req.body.form_time || 0);

    if (!formTime || Date.now() - formTime < MIN_FORM_TIME_MS) {
      return res.status(400).json({
        success: false,
        message: 'Попробуйте отправить форму чуть позже.',
      });
    }

    const phone = cleanText(req.body.phone, 40);
    const email = cleanText(req.body.email, 120);
    const car = cleanText(req.body.car, 120);
    const message = cleanText(req.body.comment, 900);
    const page = cleanText(req.body.page, 200);
    const company = cleanText(req.body.company, 120);

    if (company) {
      return res.status(400).json({
        success: false,
        message: 'Проверка не пройдена.',
      });
    }

    const phoneDigits = phone.replace(/\D/g, '');

    if (phoneDigits.length !== 11 || !/^7\d{10}$/.test(phoneDigits)) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный номер телефона в формате +7.',
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный email.',
      });
    }

    if (message.length > 900) {
      return res.status(400).json({
        success: false,
        message: 'Комментарий слишком длинный. Максимум 900 символов.',
      });
    }

    const formattedPhone = formatPhone(phoneDigits);
    const telLink = makeTelLink(phoneDigits);

    const createdAt = new Date().toLocaleString('ru-RU', {
      timeZone: 'Asia/Krasnoyarsk',
    });

    const text = `
Новая заявка с сайта АвтоZавоз

Телефон: ${formattedPhone}
Email: ${email}
Автомобиль: ${car || 'Не указан'}
Комментарий: ${message || '—'}
Страница: ${page || '—'}
Дата заявки: ${createdAt}
    `.trim();

    const html = buildEmailTemplate({
      formattedPhone,
      telLink,
      email,
      car: car || 'Не указан',
      message: message || '—',
      page: page || '—',
      createdAt,
    });

    await transporter.sendMail({
      from: `"АвтоZавоз сайт" <${process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL,
      replyTo: email,
      subject: `Заявка АвтоZавоз: ${car || 'расчет автомобиля'}`,
      text,
      html,
    });

    return res.status(200).json({
      success: true,
      message: 'Спасибо! Заявка отправлена, мы скоро свяжемся с вами.',
    });
  } catch (error) {
    console.error('Ошибка отправки заявки:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера. Попробуйте ещё раз чуть позже.',
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

transporter.verify((error) => {
  if (error) {
    console.error('Ошибка подключения к SMTP:', error);
  } else {
    console.log('SMTP готов к отправке писем');
  }
});

app.listen(PORT, () => {
  console.log(`AvtoZavoz server started: http://localhost:${PORT}`);
});

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function formatPhone(phoneDigits) {
  return `+7 (${phoneDigits.slice(1, 4)}) ${phoneDigits.slice(4, 7)}-${phoneDigits.slice(7, 9)}-${phoneDigits.slice(9, 11)}`;
}

function makeTelLink(phoneDigits) {
  return `+7${phoneDigits.slice(1)}`;
}

function emailRow(label, value) {
  return `
<tr>
<td style="padding:12px 0 4px; color:#777777; font-size:12px; text-transform:uppercase; letter-spacing:1px;">
${escapeHtml(label)}
</td>
</tr>
<tr>
<td style="padding:4px 0 16px; font-size:18px; font-weight:700; color:#ffffff; line-height:1.5;">
${value}
</td>
</tr>
`;
}

function buildEmailTemplate({
  formattedPhone,
  telLink,
  email,
  car,
  message,
  page,
  createdAt,
}) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Новая заявка АвтоZавоз</title>
</head>

<body style="margin:0; padding:0; background:#070707; font-family:Arial, sans-serif; color:#ffffff;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#070707; padding:32px 12px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" style="
  max-width:640px;
  background:#111111;
  border:1px solid rgba(255,204,0,0.18);
  border-radius:20px;
  overflow:hidden;
">

<tr>
<td style="
  padding:32px;
  background:linear-gradient(135deg,#171717 0%,#090909 100%);
  border-bottom:3px solid #ffcc00;
">

<div style="
  font-size:12px;
  letter-spacing:3px;
  text-transform:uppercase;
  color:#ffcc00;
  margin-bottom:10px;
">
АВТОZАВОЗ / ЗАЯВКА
</div>

<h1 style="
  margin:0;
  font-size:28px;
  line-height:1.2;
  text-transform:uppercase;
">
Новая заявка<br>
<span style="color:#ffcc00;">на расчет автомобиля</span>
</h1>

<p style="
  margin:14px 0 0;
  color:#a0a0a0;
  font-size:14px;
  line-height:1.6;
">
Клиент оставил заявку с формы на сайте АвтоZавоз.
</p>

</td>
</tr>

<tr>
<td style="padding:28px 32px;">

<table width="100%" cellpadding="0" cellspacing="0">

${emailRow(
  'Телефон',
  `<a href="tel:${escapeHtml(telLink)}" style="color:#ffcc00; text-decoration:none;">${escapeHtml(formattedPhone)}</a>`,
)}

${emailRow(
  'Email',
  `<a href="mailto:${escapeHtml(email)}" style="color:#ffcc00; text-decoration:none;">${escapeHtml(email)}</a>`,
)}

${emailRow('Интересующий автомобиль', escapeHtml(car))}

${emailRow('Комментарий', escapeHtml(message))}

${emailRow('Страница', escapeHtml(page))}

${emailRow('Дата заявки', escapeHtml(createdAt))}

</table>

</td>
</tr>

<tr>
<td style="
  padding:24px 32px;
  background:#0b0b0b;
  border-top:1px solid rgba(255,255,255,0.06);
">

<a href="tel:${escapeHtml(telLink)}" style="
  display:inline-block;
  padding:14px 22px;
  background:linear-gradient(180deg,#ffcc00 0%,#ffb300 40%,#ff8f00 100%);
  color:#000000;
  text-decoration:none;
  border-radius:10px;
  font-weight:700;
  text-transform:uppercase;
">
Позвонить клиенту
</a>

<p style="
  margin:16px 0 0;
  color:#666666;
  font-size:12px;
  line-height:1.5;
">
Письмо автоматически отправлено с сайта АвтоZавоз.
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}
