function App() {
  // Tus datos dinámicos listos para ser inyectados
  const usuarios = [
    { id: 1, nombre: "Mark", apellido: "Otto", handle: "@mdo" },
    { id: 2, nombre: "Jacob", apellido: "Thornton", handle: "@fat" },
    { id: 3, nombre: "John", apellido: "Doe", handle: "@social" },
    { id: 4, nombre: "Ana", apellido: "García", handle: "@anag" }
  ];

  return (
    <>
      {/* Barra de navegación de Bootstrap */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-success">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">Mi Web Personal</a>
          <button 
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a className="nav-link active" href="#">Inicio</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#">Proyectos</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#">Contacto</a>
              </li>
            </ul>
            <form className="d-flex" role="search">
              <input className="form-control me-2" type="search" placeholder="Buscar..." aria-label="Search" />
              <button className="btn btn-outline-light" type="submit">Buscar</button>
            </form>
          </div>
        </div>
      </nav>

      {/* Contenido principal de la página */}
      <div className="container mt-5 text-center">
        <h1>¡Hola React y Bootstrap!</h1>
        <p className="lead">La tabla de abajo ahora se pinta de forma dinámica usando un array de datos.</p>
        <button className="btn btn-success btn-lg mb-4">Mi primer botón</button>
        
<table className="table table-striped table-hover mt-3">
  <thead className="table-success">
    <tr>
      <th scope="col">#</th>
      <th scope="col">Nombre</th>
      <th scope="col">Apellido</th>
      <th scope="col">Handle</th>
    </tr>
  </thead>
  <tbody>
    {usuarios.map((user) => (
      <tr key={user.id}>
        <td>{user.id}</td>
        <td>{user.nombre}</td>
        <td>{user.apellido}</td>
        <td>{user.handle}</td>
      </tr>
    ))}
  </tbody>
</table>
      </div>
    </>
  )
}

export default App