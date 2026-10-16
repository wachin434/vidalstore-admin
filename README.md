# vidalstore-admin

Microservicio NestJS que expone una API REST para administrar la mensajería
de VidalStore (RabbitMQ). No toca la base de datos de negocio en ningún
momento — solo habla con la API de management de RabbitMQ (puerto 15672).

Acceso restringido: todas las rutas requieren un token válido de Cognito **y**
pertenecer al grupo `administradores` (`JwtGuard` + `RolGuard`).

## Rutas

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/v1/admin/colas` | Lista las 6 colas con sus métricas |
| GET | `/v1/admin/colas/:nombre` | Detalle de una cola puntual |
| DELETE | `/v1/admin/colas/:nombre/mensajes` | Purga (vacía) una cola |
| GET | `/v1/admin/exchanges` | Lista los 3 exchanges de VidalStore |
| GET | `/v1/admin/bindings` | Lista los bindings cola–exchange |
| GET | `/v1/admin/nodos` | Estado de los nodos del clúster |
| GET | `/v1/admin/mensajes-muertos` | Cuántos mensajes hay en cada DLQ |
| POST | `/v1/admin/politicas` | Aplica una política de retención |

## Estructura

```
src/
├── mensajeria/    topología (solo para declarar exchanges/colas al arrancar)
├── auth/           JwtGuard (verifica Cognito) + RolGuard (exige admin)
└── admin/
    ├── rabbit-admin.service.ts   toda la lógica contra la API de management
    ├── admin.controller.ts        las 8 rutas
    └── dto/aplicar-politica.dto.ts
```

## Puerto

`3020` (fijo, ver `src/main.ts`).

## Cómo correrlo

Depende del clúster RabbitMQ definido en `vidalstore-plataforma`. Ver el
`README.md` de ese repo para el procedimiento completo de arranque
(`docker compose up --build --wait`).

Variables de entorno esperadas: `RABBITMQ_URL`, `RABBITMQ_MGMT_URL`,
`RABBITMQ_MGMT_USER`, `RABBITMQ_MGMT_PASS`, `COGNITO_USER_POOL_ID`,
`COGNITO_CLIENT_ID`.