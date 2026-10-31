import { useEffect, useRef, useState } from "react";

function AccesoAdmin({ alAcceder, ocupado, error, aviso }) {
  const [usuario, establecerUsuario] = useState("");
  const [contrasena, establecerContrasena] = useState("");
  const referenciaError = useRef(null);

  useEffect(() => {
    if (error) referenciaError.current?.focus();
  }, [error]);

  async function enviarAcceso(evento) {
    evento.preventDefault();
    if (ocupado) return;
    const accesoCorrecto = await alAcceder({ usuario: usuario.trim(), contrasena });
    if (!accesoCorrecto) establecerContrasena("");
  }

  return (
    <section className="admin__acceso" aria-labelledby="acceso-titulo">
      <p className="admin__etiqueta">Acceso privado</p>
      <h1 id="acceso-titulo">Administrar el portfolio</h1>
      <p className="admin__texto">Identifícate para gestionar tus fotografías.</p>
      {aviso && <p className="alert alert-info" role="status">{aviso}</p>}
      {error && <p ref={referenciaError} className="alert alert-danger" role="alert" tabIndex={-1}>{error}</p>}
      <form onSubmit={enviarAcceso}>
        <fieldset disabled={ocupado}>
          <legend className="visually-hidden">Datos de acceso</legend>
          <div className="mb-3">
            <label className="form-label" htmlFor="admin-usuario">Usuario</label>
            <input className="form-control" id="admin-usuario" name="usuario" value={usuario}
              onChange={(evento) => establecerUsuario(evento.target.value)}
              autoComplete="username" required autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="admin-contrasena">Contraseña</label>
            <input className="form-control" id="admin-contrasena" name="contrasena" type="password"
              value={contrasena} onChange={(evento) => establecerContrasena(evento.target.value)}
              autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            {ocupado ? "Comprobando acceso…" : "Entrar"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}

export default AccesoAdmin;
