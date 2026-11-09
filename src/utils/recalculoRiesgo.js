const riesgoEstudianteService = require("../services/riesgoEstudianteService");

function programarRecalculoRiesgo(estudianteIds) {
  const ids = [...new Set(estudianteIds.map(Number).filter(Boolean))];
  if (!ids.length) return;
  setImmediate(() => {
    riesgoEstudianteService.recalcularEstudiantes(ids, { guardar: true })
      .then(({ errores }) => {
        if (errores.length) console.error("Errores al recalcular indicadores:", errores);
      })
      .catch(error => console.error("No se pudieron recalcular indicadores:", error));
  });
}

module.exports = { programarRecalculoRiesgo };