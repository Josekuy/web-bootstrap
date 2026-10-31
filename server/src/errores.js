// Un error previsto llega al cliente con un mensaje útil, sin rutas ni detalles internos.
export class ErrorAplicacion extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = "ErrorAplicacion";
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}
