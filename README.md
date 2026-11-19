# Práctica 6 - Agente IA conectado a Sakila

Esta versión amplía el chat de la práctica original: conserva Express + OpenRouter y agrega MySQL con `mysql2`.

## Estructura
- `backend/server.js`: API y selección de las tres consultas.
- `backend/database.js`: conexión a MySQL.
- `backend/.env.example`: plantilla de configuración.
- `frontend/`: interfaz del chat.

## Configuración cuando tengas acceso a la computadora con XAMPP
1. En XAMPP inicia MySQL (y Apache si usas phpMyAdmin).
2. Verifica que la base de datos se llame `sakila` y que sus tablas estén importadas.
3. En `backend`, instala dependencias con `npm install`.
4. Copia `.env.example` como `.env` y completa los datos locales. No subas `.env` a GitHub.
5. Coloca tu clave real de OpenRouter en `OPENROUTER_API_KEY`.
6. Ejecuta `npm start` dentro de `backend`.
7. Abre `frontend/index.html` en el navegador.
8. Comprueba `http://localhost:3000/api/health` para revisar la conexión a la base.

## Consultas incluidas
1. Top 3 de películas `Action` con duración mayor a 120 minutos, ordenadas por cantidad de alquileres.
2. Clientes sin alquiler o con 90 días o más sin alquilar. Los días se calculan respecto al alquiler más reciente registrado en Sakila, no respecto a la fecha actual.
3. Movimiento por día de semana y tienda: total de alquileres y promedio de ingresos diarios para ese día.

## Seguridad
- No publiques `.env`, contraseñas ni claves API.
- No expongas el puerto de MySQL a Internet.
- El código utiliza consultas SQL predefinidas; el modelo no genera SQL libre.

## Nota
Las consultas dependen del esquema estándar de la base de ejemplo Sakila. La ejecución real debe verificarse con la versión de MySQL/MariaDB instalada en XAMPP.
