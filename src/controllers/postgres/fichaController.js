const fs = require("fs");
const path = require("path");
const { respuestaError } = require("../../utils/respuestaError");

function escXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Genera el DOCX exacto de la plantilla del psicólogo (37 tablas, 105 párrafos, 1 imagen)
// rellenando la celda vacía que sigue a cada etiqueta (APELLIDOS Y NOMBRES, EDAD, ...)
async function generarFichaDocx(req, res) {
  try {
    const PizZip = require("pizzip");
    const estudianteId = Number(req.params.id || req.user.studentId || req.user.id);
    const datos = req.body.datos || req.body || {};

    const templatePath = path.join(__dirname, "../../templates/ficha-diagnostica-socioeducativa.docx");
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: "Plantilla no encontrada" });

    const zip = new PizZip(fs.readFileSync(templatePath));
    let xml = zip.file("word/document.xml").asText();

    const mapa = [
      ["APELLIDOS Y NOMBRES", datos.apellidos || datos.apellidosNombres || ""],
      ["EDAD", datos.edad || ""],
      ["GRADO", datos.grado || ""],
      ["SECCIÓN", datos.seccion || ""],
      ["SECCION", datos.seccion || ""],
      ["CORREO ELECTRONICO", datos.email || datos.correo || ""],
      ["LUGAR DE RESIDENCIA", datos.residencia || datos.lugarResidencia || ""],
      ["SEXO", datos.sexo || ""],
      ["CELULAR", datos.celular || ""],
      ["FECHA DE NACIMIENTO", datos.fechanac || datos.fechaNacimiento || ""],
      ["LUGAR DE NACIMIENTO", datos.lugarnac || datos.lugarNacimiento || ""],
      ["DOMICILIO", datos.domicilio || ""],
      ["DISTRITO", datos.distrito || ""],
      ["EN UNA EMERGENCIA ACUDIR", datos.emergencia || datos.emergenciaAcudir || ""],
      ["TELEFONO", datos.telefono || datos.telefonoFijo || datos.telefono_fijo || ""],
    ];

    let rellenos = 0;
    for (const [label, val] of mapa) {
      if (!val) continue;
      // Tolerante a atributos en <w:t> y a espacios extra en la etiqueta
      const pat = label.split(/\s+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
      const re = new RegExp(`<w:t[^>]*>\\s*${pat}\\s*</w:t>`);
      const m = re.exec(xml);
      if (!m) continue;
      const endCell = xml.indexOf("</w:tc>", m.index);
      if (endCell === -1) continue;
      const pOpen = xml.indexOf("<w:p", endCell);
      if (pOpen === -1) continue;
      const pEnd = xml.indexOf(">", pOpen);
      if (pEnd === -1) continue;
      xml = xml.slice(0, pEnd + 1)
        + `<w:r><w:t xml:space="preserve">${escXml(val)}</w:t></w:r>`
        + xml.slice(pEnd + 1);
      rellenos++;
    }

    zip.file("word/document.xml", xml);
    const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Ficha_Diagnostica_${estudianteId}.docx"`);
    return res.send(buffer);
  } catch (e) {
    respuestaError(res, e);
  }
}

module.exports = { generarFichaDocx };
