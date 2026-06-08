/**
 * Script temporal para generar un PDF de prueba con datos de lead.
 * Ejecutar: node create-test-pdf.mjs
 * Borra este archivo después de la prueba.
 */

import fs from "fs";

const lines = [
  "REQUERIMIENTO TECNICO - EMPRESA TECHCORP",
  "",
  "Datos de contacto:",
  "  Empresa:  TechCorp SA de CV",
  "  Contacto: Carlos Mendez",
  "  Cargo:    Director de Tecnologia",
  "  Email:    carlos.mendez@techcorp.com.mx",
  "  Telefono: +52 55 1234 5678",
  "",
  "Descripcion del proyecto:",
  "  Necesitamos implementar un sistema de nomina y RRHH para",
  "  gestionar a nuestros 450 empleados distribuidos en 3 oficinas.",
  "  Actualmente usamos Excel y genera muchos errores cada quincena.",
  "",
  "Presupuesto:",
  "  Contamos con presupuesto aprobado de $60,000 USD anuales.",
  "  Incluye licencias, implementacion y soporte.",
  "",
  "Urgencia:",
  "  Necesitamos tener el sistema operando antes del 1 de septiembre 2026.",
  "  Hay una auditoria fiscal programada para octubre.",
  "",
  "Autoridad de decision:",
  "  Yo (Director de Tecnologia) y el CFO somos los responsables",
  "  de la decision final. El contrato lo firma el CEO.",
  "",
  "Requerimientos tecnicos:",
  "  - Calculo de nomina quincenal y mensual",
  "  - Timbrado CFDI 4.0 (SAT Mexico)",
  "  - Control de vacaciones y ausencias",
  "  - Integracion con contabilidad (CONTPAQi)",
  "  - App movil para empleados",
  "  - Soporte en espanol 8x5",
];

function buildPdf(textLines) {
  let stream = "BT\n/F1 10 Tf\n50 780 Td\n";
  for (let i = 0; i < textLines.length; i++) {
    const escaped = textLines[i].replace(/[()\\]/g, (c) => "\\" + c);
    if (i === 0) {
      stream += `(${escaped}) Tj\n`;
    } else {
      stream += `0 -16 Td\n(${escaped}) Tj\n`;
    }
  }
  stream += "ET\n";

  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 =
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 =
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  const obj4 = `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`;
  const obj5 =
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  const header = "%PDF-1.4\n";
  const offset1 = header.length;
  const offset2 = offset1 + obj1.length;
  const offset3 = offset2 + obj2.length;
  const offset4 = offset3 + obj3.length;
  const offset5 = offset4 + obj4.length;
  const body = header + obj1 + obj2 + obj3 + obj4 + obj5;
  const xrefOffset = body.length;

  const pad = (n) => String(n).padStart(10, "0");
  const xref =
    `xref\n0 6\n` +
    `0000000000 65535 f \n` +
    `${pad(offset1)} 00000 n \n` +
    `${pad(offset2)} 00000 n \n` +
    `${pad(offset3)} 00000 n \n` +
    `${pad(offset4)} 00000 n \n` +
    `${pad(offset5)} 00000 n \n`;

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return body + xref + trailer;
}

const pdfContent = buildPdf(lines);
const pdfBuffer = Buffer.from(pdfContent, "utf-8");

fs.writeFileSync("test-lead.pdf", pdfBuffer);
console.log("PDF creado: test-lead.pdf");
console.log("");
console.log("--- BASE64 (pega esto en el campo pdfBase64 de Studio) ---");
console.log(pdfBuffer.toString("base64"));
console.log("-----------------------------------------------------------");
