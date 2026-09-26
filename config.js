// URLs configurables por sucursal. El video solicitado se muestra como señal externa.
window.KOOOBEN_CONFIG = {
  // Endpoints públicos de tus APIs. Las claves privadas nunca van aquí.
  appleWalletApiUrl: "",
  googleWalletApiUrl: "",
  // Compatibilidad con la configuración anterior de Apple Wallet.
  walletApiUrl: "",
  // Endpoint público de verificación Tlatolli. No requiere clave.
  tlatolliApiUrl: "https://turning-skins-mailed-foot.trycloudflare.com",
  branches: {
    "UPIICSA Sociales": {
      rappiUrl: "https://www.rappi.com.mx/restaurantes/1930459302-kooben-pizzas",
      streamUrl: "https://www.youtube.com/watch?v=PC8nOb8cTNg",
      availableNow: ["Pizza Napolitana", "Peppelove", "Hawaiana Tropical"]
    },
    "UPIICSA Graduados": {
      rappiUrl: "https://www.rappi.com.mx/restaurantes/1930459302-kooben-pizzas",
      streamUrl: "https://www.youtube.com/watch?v=PC8nOb8cTNg",
      availableNow: ["Pepperoni", "Boneless BBQ", "Tres Quesos"]
    }
  }
};
