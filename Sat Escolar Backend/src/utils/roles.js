const VALID_ROLES = ["estudiante", "docente", "psicologo", "director"];

function normalizeRole(role) {
  if (!role) return "";

  const cleanRole = role.trim().toLowerCase();

  if (cleanRole === "psicóloga" || cleanRole === "psicologa" || cleanRole === "psicólogo") {
    return "psicologo";
  }

  return cleanRole;
}

function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

module.exports = {
  VALID_ROLES,
  normalizeRole,
  isValidRole
};
