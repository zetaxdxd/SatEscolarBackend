const express = require("express");
const chat = require("../../controllers/mensajeAnonimoController");

const router = express.Router();

router.post("/mensajes", chat.enviarMensaje);
router.get("/mensajes/mios", chat.misMensajes);
router.post("/mensajes/:id/eliminar/solicitar", chat.solicitarEliminarMensaje);
router.post("/mensajes/:id/eliminar/confirmar", chat.confirmarEliminarMensaje);
router.post("/mensajes/borrar-chat/solicitar", chat.solicitarBorrarChat);
router.post("/mensajes/borrar-chat/confirmar", chat.confirmarBorrarChat);

router.get("/psicologia/mensajes", chat.listarMensajesPsicologo);
router.get("/psicologia/mensajes/:tipo/:id", chat.verConversacionPsicologo);
router.post("/psicologia/mensajes/:tipo/:id/responder", chat.responderConversacion);

module.exports = router;