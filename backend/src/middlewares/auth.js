import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { ADMIN_ROLE } from "../config/permisos.js";

export async function requireAuth(req, res, next) {
  if (req.authVerificado) return next();

  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Token de autenticación requerido",
    });
  }

  const token = authorization.slice(7);

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      "SELECT activo, debe_cambiar_password, version_sesion FROM usuarios WHERE id = $1",
      [req.auth.sub],
    );
    if (!rows[0]?.activo) {
      return res.status(401).json({
        error: "La cuenta ya no está disponible",
        code: "SESSION_EXPIRED",
      });
    }
    if ((req.auth.ver ?? 0) !== rows[0].version_sesion) {
      return res.status(401).json({
        error: "La sesión terminó. Vuelve a iniciar sesión.",
        code: "SESSION_REVOKED",
      });
    }
    if (
      rows[0].debe_cambiar_password &&
      !(req.baseUrl === "/api/usuarios" && req.path === "/password")
    ) {
      return res.status(403).json({
        error: "Debes cambiar tu contraseña temporal antes de continuar",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }
    req.authVerificado = true;
    next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        error: "Tu sesión expiró. Vuelve a iniciar sesión.",
        code: "SESSION_EXPIRED",
      });
    }
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.rol !== "admin_general") {
    return res.status(403).json({
      error: "No tienes permiso para crear usuarios",
    });
  }

  next();
}

export function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.auth || !rolesPermitidos.includes(req.auth.rol)) {
      return res.status(403).json({
        error: "No tienes permiso para acceder a este recurso",
      });
    }
    next();
  };
}

export function requirePermiso(permiso) {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        return res
          .status(401)
          .json({ error: "Token de autenticación requerido" });
      }
      if (req.auth.rol === ADMIN_ROLE) return next();

      const { rows } = await query(
        "SELECT 1 FROM usuario_permisos WHERE usuario_id = $1 AND permiso = $2",
        [req.auth.sub, permiso],
      );
      if (!rows[0]) {
        return res.status(403).json({
          error: "No tienes permiso para acceder a este recurso",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermiso(...permisos) {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        return res
          .status(401)
          .json({ error: "Token de autenticación requerido" });
      }
      if (req.auth.rol === ADMIN_ROLE) return next();

      const { rows } = await query(
        `SELECT 1
         FROM usuario_permisos
         WHERE usuario_id = $1 AND permiso = ANY($2::text[])
         LIMIT 1`,
        [req.auth.sub, permisos],
      );

      if (!rows[0]) {
        return res.status(403).json({
          error: "No tienes permiso para acceder a este recurso",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
