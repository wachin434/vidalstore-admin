# vidalstore-admin

API de administración de RabbitMQ (puerto **3020**). Crea y elimina colas, exchanges y
bindings por la **API HTTP de management** (15672) y, solo para grupos de 3, publica el
comando `dlq.reprocesar` por AMQP.

- Todas las rutas exigen un token de acceso de Cognito válido (firma/JWKS, emisor, vigencia,
  `token_use=access`, `client_id`) y pertenecer al grupo `administradores`, **incluidos los GET**.
- `RabbitAdminService` concentra la lógica; el controlador solo valida (DTOs) y delega.
- Esta aplicación declara únicamente el exchange `vidalstore.comandos`; no conoce ninguna cola.

## Variables de entorno

| Variable | Uso |
|---|---|
| `RABBITMQ_URL` | AMQP, para publicar el reproceso |
| `RABBITMQ_MGMT_URL` | API de management (ej. `http://rabbit1:15672`) |
| `RABBITMQ_MGMT_USER` / `RABBITMQ_MGMT_PASS` | credenciales de management |
| `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` | validación del JWT |
| `PORT` | opcional, por defecto 3020 |

## Rutas

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /v1/admin/colas` | – | 200, lista |
| `POST /v1/admin/colas` | `{nombre, durable?}` | 201 |
| `DELETE /v1/admin/colas/:nombre` | – | 204 |
| `GET /v1/admin/exchanges` | – | 200, lista |
| `POST /v1/admin/exchanges` | `{nombre, tipo, durable?}` | 201 |
| `DELETE /v1/admin/exchanges/:nombre` | – | 204 |
| `POST /v1/admin/bindings` | `{exchange, cola, routingKey}` | 201 |
| `DELETE /v1/admin/bindings` | `{exchange, cola, routingKey}` | 204 |
| `POST /v1/admin/dlq/:id/reproceso` | `{payloadCorregido?}` | 202 |

`:id` es el UUID de la fila de `eventos.mensajes_muertos`. `solicitadoPor` es el `sub` del
token, nunca el cuerpo. Publica en `vidalstore.comandos` con routing key `dlq.reprocesar`.

## Validación y errores

`ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`.
Nombres: obligatorios, sin espacios, máx. 100, patrón `^[A-Za-z0-9._-]+$`.
`tipo`: `direct | topic | fanout | headers`. `routingKey`: obligatoria, máx. 255.
`durable`: booleano, por defecto `true` (las colas durables se crean `quorum`).

| Código | Cuándo |
|---|---|
| 400 | dato inválido (el mensaje dice campo y motivo), nombre `amq.*`, rechazo del broker |
| 401 / 403 | sin token o token inválido / sin el grupo `administradores` |
| 404 | la cola, el exchange o el binding no existe |
| 409 | ya existe con otra configuración |
| 502 / 503 | broker inaccesible o credenciales de management rechazadas |

Borrar un binding: la API pide su `properties_key`, así que el servicio lista los bindings
del par exchange-cola, busca el de la `routingKey` y lo elimina.

## Ejemplos

```bash
TOKEN=<access token de un usuario del grupo administradores>
H="Authorization: Bearer $TOKEN"; J="Content-Type: application/json"
U=http://localhost:3020/v1/admin

curl -H "$H" $U/colas
curl -X POST   -H "$H" -H "$J" -d '{"nombre":"cola.prueba","durable":true}' $U/colas
curl -X POST   -H "$H" -H "$J" -d '{"nombre":"ex.prueba","tipo":"topic","durable":true}' $U/exchanges
curl -X POST   -H "$H" -H "$J" -d '{"exchange":"ex.prueba","cola":"cola.prueba","routingKey":"a.b"}' $U/bindings
curl -X DELETE -H "$H" -H "$J" -d '{"exchange":"ex.prueba","cola":"cola.prueba","routingKey":"a.b"}' $U/bindings
curl -X DELETE -H "$H" $U/exchanges/ex.prueba
curl -X DELETE -H "$H" $U/colas/cola.prueba
curl -X POST   -H "$H" -H "$J" -d '{"payloadCorregido":{"para":"a@b.cl"}}' $U/dlq/<uuid>/reproceso
# 400 esperado:
curl -X POST -H "$H" -H "$J" -d '{"nombre":""}' $U/colas
```

## Desarrollo

```bash
npm install && npm run build
npm test        # pruebas unitarias del servicio con el cliente HTTP simulado
```
