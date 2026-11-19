require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const ai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// Consulta 1: películas de acción de más de 120 minutos, ordenadas por alquileres.
const SQL_PELICULAS = `
SELECT f.film_id, f.title, f.length,
       COUNT(r.rental_id) AS veces_alquilada
FROM film f
JOIN film_category fc ON fc.film_id = f.film_id
JOIN category c ON c.category_id = fc.category_id
JOIN inventory i ON i.film_id = f.film_id
JOIN rental r ON r.inventory_id = i.inventory_id
WHERE c.name = 'Action' AND f.length > 120
GROUP BY f.film_id, f.title, f.length
ORDER BY veces_alquilada DESC
LIMIT 3
`;

// Consulta 2: inactividad medida respecto al último alquiler registrado en Sakila.
// Incluye clientes que nunca han alquilado y clientes con 90+ días de inactividad.
const SQL_CLIENTES = `
SELECT c.customer_id, c.first_name, c.last_name, c.email,
       MAX(r.rental_date) AS ultimo_alquiler,
       DATEDIFF((SELECT MAX(r2.rental_date) FROM rental r2),
                MAX(r.rental_date)) AS dias_inactivo
FROM customer c
LEFT JOIN rental r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
HAVING MAX(r.rental_date) IS NULL OR dias_inactivo >= 90
ORDER BY ultimo_alquiler ASC
LIMIT 20
`;

// Consulta 3: alquileres y promedio de ingresos diarios por día de semana y tienda.
const SQL_MOVIMIENTO = `
SELECT d.store_id,
       CASE d.dia_num
         WHEN 1 THEN 'Domingo' WHEN 2 THEN 'Lunes'
         WHEN 3 THEN 'Martes' WHEN 4 THEN 'Miércoles'
         WHEN 5 THEN 'Jueves' WHEN 6 THEN 'Viernes'
         WHEN 7 THEN 'Sábado'
       END AS dia_semana,
       SUM(d.alquileres) AS total_alquileres,
       ROUND(AVG(d.ingreso_diario), 2) AS ingreso_promedio_diario
FROM (
  SELECT i.store_id,
         DAYOFWEEK(p.payment_date) AS dia_num,
         DATE(p.payment_date) AS fecha,
         COUNT(DISTINCT p.rental_id) AS alquileres,
         SUM(p.amount) AS ingreso_diario
  FROM payment p
  JOIN rental r ON r.rental_id = p.rental_id
  JOIN inventory i ON i.inventory_id = r.inventory_id
  GROUP BY i.store_id, DATE(p.payment_date), DAYOFWEEK(p.payment_date)
) d
GROUP BY d.store_id, d.dia_num
ORDER BY total_alquileres DESC
`;

function detectarConsulta(message) {
  const m = message.toLowerCase();
  // Primero detectamos clientes: esa pregunta también contiene la palabra película/alquilar.
  if (m.includes('cliente') || m.includes('dejar') || m.includes('inactivo') ||
      m.includes('tiempo sin alquilar') || m.includes('sin alquilar')) return 'clientes';
  if (m.includes('día') || m.includes('dia') || m.includes('semana') ||
      m.includes('movimiento') || m.includes('recauda') || m.includes('dinero') ||
      m.includes('ingreso')) return 'movimiento';
  if (m.includes('película') || m.includes('pelicula') || m.includes('acción') ||
      m.includes('accion') || m.includes('alquile')) return 'peliculas';
  return 'chat';
}

async function resumirConIA(pregunta, datos, etiqueta) {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'PEGA_AQUI_TU_CLAVE') {
    return `La consulta a Sakila se ejecutó correctamente. Estos son los resultados (${etiqueta}):\n${JSON.stringify(datos, null, 2)}\n\nConfigura OPENROUTER_API_KEY en tu archivo .env para que la IA redacte un análisis en lenguaje natural.`;
  }

  const completion = await ai.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content:
        'Eres un asistente que analiza resultados de la base Sakila. Responde en español, claro y breve. Basa todas las conclusiones únicamente en los datos entregados. No inventes cifras. Aclara que los clientes inactivos son candidatos para seguimiento, no una predicción segura de abandono. En ingresos, explica que se calcula el promedio de ingresos diarios para cada día de semana y tienda.' },
      { role: 'user', content: `Pregunta: ${pregunta}\nTipo de análisis: ${etiqueta}\nResultados SQL: ${JSON.stringify(datos)}` }
    ]
  });
  return completion.choices?.[0]?.message?.content || 'No se pudo generar el análisis.';
}

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ server: 'ok', database: 'connected', databaseName: process.env.DB_NAME || 'sakila' });
  } catch (err) {
    res.status(500).json({ server: 'ok', database: 'error', detail: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Escribe una pregunta.' });
    }

    const tipo = detectarConsulta(message);
    if (tipo === 'chat') {
      if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'PEGA_AQUI_TU_CLAVE') {
        return res.json({ reply: 'Puedo responder las tres consultas de Sakila. Pregúntame por películas de acción largas, clientes inactivos o movimiento e ingresos por día de la semana.' });
      }
      const completion = await ai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un asistente de una tienda de películas. Responde en español. Para datos de Sakila, pide que el usuario formule una de las tres consultas disponibles si no hay resultados SQL.' },
          ...history.filter(x => ['user', 'assistant'].includes(x.role)).slice(-8),
          { role: 'user', content: message }
        ]
      });
      return res.json({ reply: completion.choices?.[0]?.message?.content || 'No pude generar una respuesta.' });
    }

    let sql, etiqueta;
    if (tipo === 'peliculas') { sql = SQL_PELICULAS; etiqueta = 'Top 3 películas Action de más de 120 minutos por cantidad de alquileres'; }
    if (tipo === 'clientes') { sql = SQL_CLIENTES; etiqueta = 'Clientes sin alquiler o con 90 días o más de inactividad, calculados desde el último alquiler registrado'; }
    if (tipo === 'movimiento') { sql = SQL_MOVIMIENTO; etiqueta = 'Actividad e ingreso promedio diario por día de semana y tienda'; }

    const [rows] = await db.query(sql);
    const reply = await resumirConIA(message, rows, etiqueta);
    res.json({ reply, data: rows, queryType: tipo });
  } catch (error) {
    console.error('Error en /api/chat:', error.message);
    res.status(500).json({
      error: 'No se pudo consultar Sakila. Verifica que MySQL esté encendido, que exista la base sakila y que las credenciales sean correctas.',
      detail: error.message
    });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`));
