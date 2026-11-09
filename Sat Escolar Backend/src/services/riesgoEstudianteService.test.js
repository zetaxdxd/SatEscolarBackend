const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularAcademico,
  calcularComportamiento,
  calcularAsistencia,
  calcularCuestionario,
  determinarSemaforo
} = require("./riesgoEstudianteService");

function calificaciones(niveles) {
  return niveles.map((nivelLogro, indice) => ({
    nivel_logro: nivelLogro,
    trimestre_orden: 1 + Math.floor(indice / 4)
  }));
}

function asistencia(porcentajeAsistencia) {
  return { disponible: true, porcentaje_asistencia: porcentajeAsistencia };
}

test("calcula el ejemplo académico 70% A, 20% B y 10% C", () => {
  const resultado = calcularAcademico(calificaciones(["A", "A", "A", "A", "A", "A", "A", "B", "B", "C"]));
  assert.equal(resultado.puntaje, 74.5);
  assert.equal(resultado.distribucion.A.porcentaje, 70);
  assert.equal(resultado.distribucion.B.porcentaje, 20);
  assert.equal(resultado.distribucion.C.porcentaje, 10);
});

test("aplica la escala de asistencia e invierte el riesgo del cuestionario para la fórmula global", () => {
  const registros = [
    ...Array.from({ length: 8 }, () => ({ estado: "Asistió" })),
    ...Array.from({ length: 2 }, () => ({ estado: "Faltó" }))
  ];
  assert.equal(calcularAsistencia(registros).puntaje, 65);
  const cuestionario = calcularCuestionario([{ puntaje_riesgo: 80 }, { puntaje_riesgo: 90 }]);
  assert.equal(cuestionario.puntaje_riesgo, 85);
  assert.equal(cuestionario.puntaje, 15);
});

test("interpreta 0 como ausencia de riesgo y 100 como riesgo alto", () => {
  const sinRiesgo = calcularCuestionario([{ puntaje_riesgo: 0 }]);
  const riesgoAlto = calcularCuestionario([{ puntaje_riesgo: 100 }]);

  assert.equal(sinRiesgo.puntaje_riesgo, 0);
  assert.equal(sinRiesgo.puntaje, 100);
  assert.equal(riesgoAlto.puntaje_riesgo, 100);
  assert.equal(riesgoAlto.puntaje, 0);
});

test("fuerza rojo cuando más del 30% está en C", () => {
  const academico = calcularAcademico(calificaciones(["C", "C", "C", "C", "A", "A", "A", "A", "A", "A"]));
  const resultado = determinarSemaforo({ puntajeGlobal: 90, academico, asistencia: asistencia(95), datosCompletos: true });
  assert.equal(resultado.estado, "ROJO");
  assert.equal(resultado.tipo, "Riesgo académico");
});

test("fuerza amarillo cuando más del 50% está en B", () => {
  const academico = calcularAcademico(calificaciones(["B", "B", "B", "B", "B", "B", "A", "A", "A", "A"]));
  const resultado = determinarSemaforo({ puntajeGlobal: 80, academico, asistencia: asistencia(95), datosCompletos: true });
  assert.equal(resultado.estado, "AMARILLO");
});

test("marca verde cuando AD y A representan al menos el 80%", () => {
  const academico = calcularAcademico(calificaciones(["AD", "AD", "AD", "AD", "A", "A", "A", "A", "B", "C"]));
  const resultado = determinarSemaforo({ puntajeGlobal: 80, academico, asistencia: asistencia(95), datosCompletos: true });
  assert.equal(resultado.estado, "VERDE");
});

test("asistencia menor al 75% fuerza rojo aunque el académico sea alto", () => {
  const academico = calcularAcademico(calificaciones(Array(10).fill("AD")));
  const resultado = determinarSemaforo({ puntajeGlobal: 90, academico, asistencia: asistencia(70), datosCompletos: true });
  assert.equal(resultado.estado, "ROJO");
  assert.equal(resultado.tipo, "Riesgo por inasistencia");
});

test("desempeño alto y asistencia entre 75% y 79% produce riesgo atípico", () => {
  const academico = calcularAcademico(calificaciones(Array(10).fill("AD")));
  const resultado = determinarSemaforo({ puntajeGlobal: 90, academico, asistencia: asistencia(78), datosCompletos: true });
  assert.equal(resultado.estado, "AMARILLO");
  assert.equal(resultado.tipo, "Riesgo por inasistencia");
});

test("calcula el puntaje de comportamiento con la escala Excelente-Bueno-Regular-Deficiente", () => {
  const resultado = calcularComportamiento([
    { nivel: "Excelente", trimestre_orden: 1 },
    { nivel: "Bueno", trimestre_orden: 1 },
    { nivel: "Deficiente", trimestre_orden: 1 }
  ]);
  assert.equal(resultado.puntaje, 66.67);
  assert.equal(resultado.porcentaje_deficiente, 33.33);
  assert.equal(resultado.disponible, true);
});

test("comportamiento deficiente fuerza rojo con tipo Riesgo conductual", () => {
  const academico = calcularAcademico(calificaciones(Array(10).fill("AD")));
  const comportamiento = calcularComportamiento([
    { nivel: "Deficiente", trimestre_orden: 1 },
    { nivel: "Bueno", trimestre_orden: 2 }
  ]);
  const resultado = determinarSemaforo({
    puntajeGlobal: 90,
    academico,
    asistencia: asistencia(95),
    comportamiento,
    datosCompletos: true
  });
  assert.equal(resultado.estado, "ROJO");
  assert.equal(resultado.tipo, "Riesgo conductual");
});

test("comportamiento sin registros no está disponible", () => {
  const resultado = calcularComportamiento([]);
  assert.equal(resultado.disponible, false);
  assert.equal(resultado.puntaje, null);
});
