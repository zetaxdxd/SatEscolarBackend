const { pool, closePool } = require("../config/postgres");

const credenciales = [
  ["Gilma", "Torres Tuesta", "gilma.torres@ofelia.edu.pe", "$2a$10$Bchw3nHfV08qmvhUzuzmI.LBVR2M4pBQy5lImRp9ca3Zstu97RivS"],
  ["Maria Edith", "Navarro Pinedo", "maria.navarro@ofelia.edu.pe", "$2a$10$xFIMcwv06by2tMGP.UJCNeHNdOcU9/N7qrJ2mSaeM8NXgR9f3JONK"],
  ["Juan Natanael", "Zambrano Romero", "juan.zambrano@ofelia.edu.pe", "$2a$10$v1RcMwlU1CaM.bhbRuyjR..uYtuoV8d8XwFXC/SKul6EmyIsUV.Fe"],
  ["Milagros", "Castillo Sanchez", "milagros.castillo@ofelia.edu.pe", "$2a$10$hAVUnE.U/l46MT0VcvwHtODUrTxVD/fFbunycZMmHvJpyt2LGWvQC"],
  ["Nerlin", "Flores Perez", "nerlin.flores@ofelia.edu.pe", "$2a$10$vpzhZLXpfBFA6OHxeYdz6Owu1zIvw52h/sCZtbxwRZpVUj1U2mFPG"],
  ["José Wilson", "Mego Macedo", "jose.mego@ofelia.edu.pe", "$2a$10$U8SEsYEgXC6GV.U/v3h13OSj1kELy7bZo6gvvBW.sLrRMrVKJdJ12"],
  ["Marco Anthony", "Del Aguila Morey", "marco.delaguila@ofelia.edu.pe", "$2a$10$txZFET7tWt.RMRcRpcvrj.TFP7cLAttkVMUdK9tyjIeYzJYH2X1ri"],
  ["Roxana Milagros", "Oliva Rojas", "roxana.oliva@ofelia.edu.pe", "$2a$10$SYoHIV7.54UpKPFGJkdkn.Shrw1idR2msX3nI.T2FwSb.nRx8IZD6"],
  ["Sindy Marisela", "Romero Tejada", "sindy.romero@ofelia.edu.pe", "$2a$10$FioQobO8zlskt1I5rrCV4uikiqvXp/aEgFySIAa0tGhjrcnJ726iy"],
  ["Marcia Rosanna", "Perez Rodriguez", "marcia.perez@ofelia.edu.pe", "$2a$10$hNxUrX.bEtQS.OUE2IJLne76g.Z9GKY1R73sxckGjFzzZgfIoaH6y"],
  ["Beatriz", "Canario Tello", "beatriz.canario@ofelia.edu.pe", "$2a$10$CtqUySJkTwSWNCnd8Ig.MOiyHnoB25HPJbNbsVR.N9ViDIoNDXFC."],
  ["Marina", "Grandez Gonzales", "marina.grandez@ofelia.edu.pe", "$2a$10$k5S65/allzCgqmecNc0IIOkaeHhDouDk7ol3FLMnSMuALiLMgiMU2"],
  ["Maria Rogelia", "Vela Mego", "maria.vela@ofelia.edu.pe", "$2a$10$C/DYXi42mXOnHpCVwHn2SeXoq9Va8E2plLXwe2YF0JAyJmdE19Av."],
  ["Weider", "Viena Flores", "weider.viena@ofelia.edu.pe", "$2a$10$Pc7BKu9hKrKp9phIFabK6.BZusnvH6WkxKImBk0Jhlst9ERVuWkBK"],
  ["Eudes Guillermo", "Paredes Torres", "eudes.paredes@ofelia.edu.pe", "$2a$10$7hxsc59LnvUK6adOp8z2l.olUqvFaINtpncHojKisp3EWsYB5e0zy"],
  ["Cesar Felix", "Cabanillas Becerra", "cesar.cabanillas@ofelia.edu.pe", "$2a$10$ixl91K3Gq8XW/DL1OTW4rubuJ2bul86CL4c6mpYwjh76cW/HwGpM2"],
  ["Aurorar Alisabeth", "Tocas Vasquez", "aurorar.tocas@ofelia.edu.pe", "$2a$10$0O0eiqq4zi2BKI3Ak4T5Su7hzly1RmfgeEgNa.gDjsctOTUDnxRP6"],
  ["Felipe", "Archenti Viena", "felipe.archenti@ofelia.edu.pe", "$2a$10$SZeJ3TvIEE62cpp3gHaTXOb10KMnN6P62W2RbdEyxMVRVZTouRHde"],
  ["Alex", "Pinedo Gomez", "alex.pinedo@ofelia.edu.pe", "$2a$10$2uCw36bnGGbdKLC.mCTQTu7qyZBdYPK1sQefnHKRZwqKTOLAO9YGC"],
  ["Jennry", "Davila Amasifuen", "jennry.davila@ofelia.edu.pe", "$2a$10$nXWkk1Ajq3yzryySf8wHPOfGBAEUWjtcGWyZMG8ayQyicWJU4ap.a"]
];

async function seedDocenteCredentials() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let actualizados = 0;

    for (const [nombres, apellidos, correo, passwordHash] of credenciales) {
      const result = await client.query(
        `
          UPDATE docentes
          SET correo = $3,
              password_hash = $4,
              debe_cambiar_password = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE LOWER(nombres) = LOWER($1)
            AND LOWER(apellidos) = LOWER($2)
        `,
        [nombres, apellidos, correo, passwordHash]
      );
      if (result.rowCount !== 1) {
        throw new Error(`No se encontró un único docente para ${nombres} ${apellidos}`);
      }
      actualizados += result.rowCount;
    }

    await client.query("COMMIT");
    console.log(`Credenciales configuradas para ${actualizados} docentes`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedDocenteCredentials()
  .catch(error => {
    console.error("Error configurando credenciales docentes:", error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
