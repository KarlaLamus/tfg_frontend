# Frontend - React Application

## Requisitos previos

Antes de ejecutar el proyecto, asegúrate de tener instalado:

- Node.js
- npm

## Configuración del entorno

1. Obtén el archivo `.env` correspondiente al frontend.
2. Coloca el archivo `.env` en la raíz del proyecto frontend.

La estructura debería quedar similar a:

```bash
frontend/
├── src/
├── public/
├── .env
├── package.json
└── vite.config.js
````

## Instalación de dependencias

Ejecuta el siguiente comando para instalar las dependencias del proyecto:

```bash
npm install
```

## Ejecución del proyecto

Levanta la aplicación en entorno de desarrollo con:

```bash
npm run dev
```

## Importante

Asegúrate de que la aplicación se haya iniciado en el puerto `5173`, ya que el backend tiene configurado el CORS para permitir peticiones desde dicho puerto.

La URL correcta debe ser:

```bash
http://localhost:5173
```

## Acceso a la aplicación

Abre el navegador y accede a:

```bash
http://localhost:5173
```