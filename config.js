// URLs configurables por sucursal. El video solicitado se muestra como señal externa.
window.KOOOBEN_CONFIG = {
  // Endpoint público de tu API. La clave privada nunca va aquí.
  walletApiUrl: "",
  branches: {
    "UPIICSA Sociales": {
      rappiUrl: "https://www.rappi.com.mx/restaurantes/1930459302-kooben-pizzas",
      streamUrl: "https://www.youtube.com/embed/PC8nOb8cTNg?rel=0&modestbranding=1",
      availableNow: ["Pizza Napolitana", "Peppelove", "Hawaiana Tropical"]
    },
    "UPIICSA Graduados": {
      rappiUrl: "https://www.rappi.com.mx/restaurantes/1930459302-kooben-pizzas",
      streamUrl: "https://www.youtube.com/embed/PC8nOb8cTNg?rel=0&modestbranding=1",
      availableNow: ["Pepperoni", "Boneless BBQ", "Tres Quesos"]
    }
  }
};
