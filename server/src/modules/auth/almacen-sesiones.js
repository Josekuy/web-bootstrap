import session from "express-session";

// get/set/destroy/touch son los nombres que exige express-session para su almacén.
export class AlmacenSesionesMysql extends session.Store {
  constructor(pool, duracion) {
    super();
    this.pool = pool;
    this.duracion = duracion;
    this.temporizador = setInterval(() => {
      this.pool.execute("DELETE FROM sesiones WHERE expira < ?", [Date.now()])
        .catch((error) => console.error("No se pudieron limpiar las sesiones caducadas:", error.code));
    }, 15 * 60 * 1000);
    this.temporizador.unref();
  }

  obtenerCaducidad(sesion) {
    return sesion.cookie?.expires ? new Date(sesion.cookie.expires).getTime() : Date.now() + this.duracion;
  }

  get(identificador, devolver) {
    this.pool.execute("SELECT datos, expira FROM sesiones WHERE id = ?", [identificador])
      .then(async ([filas]) => {
        if (!filas.length) return null;
        if (Number(filas[0].expira) <= Date.now()) {
          await this.pool.execute("DELETE FROM sesiones WHERE id = ?", [identificador]);
          return null;
        }
        return JSON.parse(filas[0].datos);
      }).then((sesion) => devolver(null, sesion), devolver);
  }

  set(identificador, sesion, devolver = () => {}) {
    this.pool.execute(
      "INSERT INTO sesiones (id, datos, expira) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE datos = VALUES(datos), expira = VALUES(expira)",
      [identificador, JSON.stringify(sesion), this.obtenerCaducidad(sesion)],
    ).then(() => devolver(null), devolver);
  }

  destroy(identificador, devolver = () => {}) {
    this.pool.execute("DELETE FROM sesiones WHERE id = ?", [identificador])
      .then(() => devolver(null), devolver);
  }

  touch(identificador, sesion, devolver = () => {}) {
    // UPDATE no resucita una sesión que se haya cerrado en otra petición simultánea.
    this.pool.execute("UPDATE sesiones SET datos = ?, expira = ? WHERE id = ?", [
      JSON.stringify(sesion), this.obtenerCaducidad(sesion), identificador,
    ]).then(() => devolver(null), devolver);
  }

  cerrar() {
    clearInterval(this.temporizador);
  }
}
