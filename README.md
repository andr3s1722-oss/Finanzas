# A$ · Finanzas

App estática personal, sin servidor de datos ni proceso de compilación.

## Estructura y despliegue

La versión original contenía únicamente `index.html`: estilos, pantallas, cálculos, importación/exportación y persistencia. No había dependencias ni workflows propios. GitHub Pages publica desde `main` mediante el workflow administrado `pages build and deployment`; la ejecución 33594398687 terminó correctamente el 2 de septiembre de 2026 sobre `cccf4127`.

- `index.html`: pantallas originales, formularios, almacenamiento y arranque.
- `finance.js`: cálculos puros de áreas, semanas, alertas y proyección.
- `planning.js`: interfaz semanal, áreas, alertas y plan Colombia.
- `modern.css`: diseño adaptable, temas claro/oscuro, foco y movimiento reducido.
- `tests/finance.test.cjs`: pruebas sin dependencias externas.

Los tres archivos nuevos de la app usan rutas relativas, compatibles con `/Finanzas/` en GitHub Pages. Fusionar la rama a `main` actualiza la web mediante el despliegue existente. Esta propuesta no cambia la configuración de Pages.

## Datos y compatibilidad

Se mantiene `finanzas_andres_v3` y la lectura de `finanzas_andres_v2`. Las colecciones originales, IDs, enlaces `tipId`, `spread`, monedas, categorías y campos desconocidos se conservan; siguen funcionando las migraciones previas de alimentación y activos. No hay datos personales dentro del repositorio. Los datos siguen viviendo en cada navegador y origen; una vista local no lee los datos de GitHub Pages.

Se añaden únicamente campos opcionales:

- `expenses[].area` e `income[].area`: Personal, Saava, Inversiones, Carro, Viajes, Extraordinarios.
- `settings.colombia`: `start` (AAAA-MM), `saavaRevenue`, `saavaCosts`, `livingCosts`, `otherIncome`, `movingCost` (USD) y `reserveDebt` (booleano).

Sin `area`, Saava se reconoce por `category` o `venture`; Ninas y Sequo se agrupan como Inversiones conservando la categoría. Transporte se mantiene en Personal: no se supone que todo transporte sea un costo del carro. Las clasificaciones ambiguas se pueden cambiar al editar cada registro. El filtro de movimientos abarca todas las fechas; las tarjetas del resumen muestran el mes seleccionado.

## Criterios de cálculo

- Semanas completas de lunes a domingo, incluso al cruzar meses/años. Ingresos = `income` + horas × tarifa actual. El salario se atribuye a Personal y se incluye en balances y alertas. Se calcula al mostrar la app sin añadir registros al JSON. No registrar de nuevo el pago de esas horas, pues se sumaría dos veces. Cambiar la tarifa recalcula estimaciones históricas, como en la versión original. Las propinas ligadas se cuentan una sola vez.
- Balance semanal = ingresos registrados + salario por horas − gastos pagados. Incluye todas las áreas al seleccionar Todos. El presupuesto semanal Personal respeta `spread`, sin confundir el reparto presupuestario con el pago real.
- Alertas dentro de la app: 80% del presupuesto personal, exceso del presupuesto, 80% de cupo de tarjeta, deudas vencidas o dentro de 7 días, flujo mensual negativo y déficit del escenario Colombia. Son umbrales de interfaz, no asesoría ni notificaciones externas. Los avisos de deuda leen `dueDate` o `vence` en formato AAAA-MM-DD; texto libre se conserva sin interpretar.
- Colombia: ventas Saava − costos Saava + otros ingresos − gastos de vida; propinas y salario del café son cero. Efectivo inicial = activos tipo Liquidez − mudanza − deudas actuales si se activa la reserva. Proyección constante de 12 meses, sin rendimientos, crecimiento o ingresos previos al regreso supuestos. Incluir impuestos y cuotas futuras dentro de los costos.
- Jetta: referencia USD 6,000; si falta hay un botón explícito para registrarlo como Vehículo. Un Jetta existente conserva su valoración y no se duplica. No se suma como efectivo ni se presupone una venta.

## Verificación

```sh
node --test tests/finance.test.cjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Las pruebas usan ejemplos sintéticos, no un respaldo real del usuario. Antes de publicar, exportar el respaldo desde la web actual permite conservar una copia externa. La contraseña de entrada continúa siendo un bloqueo cosmético, como ya advierte Ajustes; no hay autenticación de servidor.
