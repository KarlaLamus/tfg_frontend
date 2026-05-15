import * as React from "react";
// Importa React para usar JSX y tipos como ComponentProps

import { cn } from "./utils";
// Función para combinar clases CSS


function Card({ className, ...props }: React.ComponentProps<"div">) {
  // className → permite añadir estilos extra desde fuera
  // ...props → recoge el resto de props (children, onClick, etc.)
  // ComponentProps<"div"> → permite usar todas las props de un <div>

  return (
    <div
      data-slot="card"
      // Atributo identificador (útil para debug o estilos avanzados)

      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border",
        // Clases base:
        // bg-card → fondo
        // text-card-foreground → color del texto
        // flex flex-col → layout vertical
        // gap-6 → espacio entre elementos
        // rounded-xl → bordes redondeados
        // border → borde

        className,
        // Permite añadir clases extra desde fuera
      )}

      {...props}
      // Pasa todas las props al div (children, eventos, etc.)
    />
  );
}


function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  // Componente para la cabecera del Card

  return (
    <div
      data-slot="card-header"
      // Identificador del header

      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 pt-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        // Layout:
        // grid → usa grid
        // grid-rows-[auto_auto] → dos filas (título + descripción)
        // gap-1.5 → espacio entre elementos
        // px-6 pt-6 → padding
        // has-data-[slot=card-action] → si hay acción, crea dos columnas
        // [.border-b]:pb-6 → si hay borde abajo, añade padding inferior

        className,
      )}

      {...props}
    />
  );
}


function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  // Componente para el título del Card

  return (
    <h4
      data-slot="card-title"
      // Identificador del título

      className={cn(
        "leading-none",
        // Reduce el espacio entre líneas

        className,
      )}

      {...props}
    />
  );
}


function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  // Componente para la descripción del Card

  return (
    <p
      data-slot="card-description"
      // Identificador de la descripción

      className={cn(
        "text-muted-foreground",
        // Texto con color más suave (gris)

        className,
      )}

      {...props}
    />
  );
}


function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  // Componente para acciones (botones en la esquina)

  return (
    <div
      data-slot="card-action"
      // Identificador de acción

      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        // Posicionamiento en el grid:
        // col-start-2 → columna derecha
        // row-span-2 → ocupa dos filas
        // row-start-1 → empieza arriba
        // justify-self-end → alineado a la derecha

        className,
      )}

      {...props}
    />
  );
}


function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  // Contenido principal del Card

  return (
    <div
      data-slot="card-content"
      // Identificador del contenido

      className={cn(
        "px-6 [&:last-child]:pb-6",
        // px-6 → padding horizontal
        // &:last-child → si es el último elemento, añade padding abajo

        className,
      )}

      {...props}
    />
  );
}


function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  // Pie del Card (normalmente botones)

  return (
    <div
      data-slot="card-footer"
      // Identificador del footer

      className={cn(
        "flex items-center px-6 pb-6 [.border-t]:pt-6",
        // flex → layout horizontal
        // items-center → centra verticalmente
        // px-6 → padding horizontal
        // pb-6 → padding abajo
        // [.border-t]:pt-6 → si hay borde arriba, añade padding arriba

        className,
      )}

      {...props}
    />
  );
}


// Exporta todos los componentes para poder usarlos en otras partes
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};