const prisma = require("../db");
async function requirePushAdmin(req, res, next) {
  try {
    const id = Number(req.session?.admin?.id);
    if (!Number.isSafeInteger(id) || id < 1)
      return res
        .status(401)
        .json({ success: false, message: "Не авторизован" });
    const admin = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!admin?.isActive)
      return res
        .status(401)
        .json({ success: false, message: "Доступ отключён" });
    next();
  } catch (error) {
    next(error);
  }
}
module.exports = requirePushAdmin;
