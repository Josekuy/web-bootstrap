  // ==========================================
  // 1. DATOS DINÁMICOS (Simulando una Base de Datos)
  // ==========================================
  // En un entorno profesional, este array de objetos vendría de una API o Base de Datos.
  // Estructurarlo así nos permite separar los "datos" del "diseño visual".
  export const proyectos = [
    {
      id: 1, // IMPORTANTE: React exige un identificador único (key) para las listas.
      titulo: "Rediseño Campus Virtual",
      descripcion: "Interfaz moderna y accesible enfocada en la experiencia de usuario educativa.",
      categoria: "UI/UX & Front-End",
      tecnologias: ["React", "Bootstrap", "Figma"],
      imagen: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=600&auto=format&fit=crop"
    },
    {
      id: 2,
      titulo: "Sistema de Diseño Editorial",
      descripcion: "Automatización de maquetación y estructuración de contenidos complejos para publicaciones.",
      categoria: "Diseño Gráfico",
      tecnologias: ["InDesign", "ExtendScript", "XML"],
      imagen: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=600&auto=format&fit=crop"
    },
    {
      id: 3,
      titulo: "Landing Page Interactiva",
      descripcion: "Sitio web corporativo optimizado para conversión, velocidad y rendimiento web.",
      categoria: "Web Design",
      tecnologias: ["HTML/CSS", "JavaScript", "Bootstrap"],
      imagen: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&auto=format&fit=crop"
    },
    {
      id: 4,
      titulo: "Portada de disco",
      descripcion: "Diseño de portada para álbum musical con enfoque en la estética visual y el mensaje del artista.",
      categoria: "Diseño Gráfico",
      tecnologias: ["Photoshop", "Illustrator", "Indesign", "After Effects"],
      imagen: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"
    }
  ];