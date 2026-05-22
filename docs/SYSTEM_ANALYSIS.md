# Especificación de Requerimientos de Software (SRS): Sistema de Punto de Venta (POS)

## 1. Introducción

### 1.1 Propósito
El presente documento tiene como objetivo definir las especificaciones técnicas y funcionales para el desarrollo de un sistema de Punto de Venta (POS). Este sistema busca optimizar el proceso de ventas, el control de inventarios y la gestión financiera de un establecimiento comercial, integrando métodos de pago modernos y flujos de trabajo eficientes.

### 1.2 Alcance del Sistema
El sistema cubrirá desde la apertura de la jornada laboral (apertura de caja) hasta el cierre y reporte diario. Incluye la gestión de productos, el procesamiento de ventas híbridas (efectivo y virtuales), la sincronización de stock en tiempo real y la administración de roles de usuario.

### 1.3 Definiciones, Acrónimos y Abreviaturas
- **POS**: Point of Sale (Punto de Venta).
- **RBAC**: Role-Based Access Control (Control de Acceso Basado en Roles).
- **ACID**: Atomicidad, Consistencia, Aislamiento y Durabilidad (Propiedades de transacciones de BD).
- **SignalR**: Librería de ASP.NET para comunicación bidireccional en tiempo real.
- **Webhook**: Notificación HTTP automática enviada por un servicio externo.

---

## 2. Descripción General

### 2.1 Perspectiva del Producto
El sistema se concibe como una aplicación web distribuida. El frontend actuará como la terminal de venta, mientras que el backend centralizará la lógica de negocio y la persistencia de datos, permitiendo que múltiples terminales operen sobre la misma base de datos de inventario.

### 2.2 Funciones del Producto
Las funciones principales se dividen en tres módulos críticos:
1. **Módulo de Ventas**: Gestión de carrito, escaneo de productos y procesamiento de pagos.
2. **Módulo de Inventario**: Control de existencias, alertas de stock y gestión de productos.
3. **Módulo Administrativo**: Gestión de usuarios, cierre de caja y reportes analíticos.

### 2.3 Justificación del Stack Tecnológico
- **React**: Elegido por su capacidad de crear interfaces altamente reactivas, permitiendo que el cajero opere sin recargas de página.
- **ASP.NET Core (C#)**: Proporciona un entorno tipado y robusto, ideal para manejar transacciones financieras y lógicas de negocio complejas con alta performance.
- **MySQL**: Base de datos relacional que garantiza la integridad de los datos mediante transacciones ACID, fundamental para el control de stock.
- **Mercado Pago API**: Estándar de industria para pagos digitales en la región, permitiendo la automatización de cobros vía QR.

---

## 3. Requerimientos Funcionales (RF)

### 3.1 Gestión de Ventas y Checkout
- **RF-01: Registro de Productos**: El sistema debe permitir la adición de productos al carrito mediante el escaneo de código de barras o búsqueda manual.
- **RF-02: Gestión de Carrito**: El sistema debe permitir modificar cantidades, aplicar descuentos autorizados y eliminar ítems antes de finalizar la venta.
- **RF-03: Procesamiento de Pagos Híbridos**: El sistema debe soportar el cobro en efectivo y la generación de QR Dinámicos de Mercado Pago.
- **RF-04: Emisión de Comprobantes**: Al finalizar la venta, el sistema debe generar un ticket digital o físico con el detalle de la transacción.

### 3.2 Pagos Virtuales e Integración QR
- **RF-05: Generación de QR Dinámico**: El sistema debe solicitar a la API de Mercado Pago la creación de un QR único por venta, donde el monto sea predefinido.
- **RF-06: Confirmación Asíncrona**: El sistema debe implementar un listener de Webhooks para recibir la confirmación de pago de Mercado Pago en tiempo real.
- **RF-07: Notificación Push**: Mediante SignalR, el backend debe notificar al frontend la confirmación del pago sin intervención del usuario.

### 3.3 Control de Inventario y Almacén
- **RF-08: Actualización de Stock**: Cada venta confirmada debe reducir automáticamente la cantidad de productos en la base de datos.
- **RF-09: Alertas de Stock Crítico**: El sistema debe notificar al administrador cuando un producto alcance un límite mínimo predefinido.
- **RF-10: Gestión de SKU**: Soporte para la creación y edición de códigos de producto únicos.

### 3.4 Gestión Financiera y Seguridad
- **RF-11: Sesiones de Caja**: El sistema debe obligar al cajero a realizar la apertura de caja con un monto inicial y el cierre con un arqueo físico.
- **RF-12: Control de Roles (RBAC)**: Restricción de funciones críticas (como anular ventas o cambiar precios) solo a usuarios con rol de Administrador.

---

## 4. Modelo Detallado de Interacción y Flujo Operativo

En esta sección se describen los flujos operativos del sistema, detallando la secuencia de eventos y la respuesta del software ante las acciones del usuario.

### 4.1 Proceso de Venta Estándar
El flujo de venta representa la interacción principal del operador con el sistema:
1. **Carga de Productos**: El operador realiza el escaneo del código de barras del producto; el sistema valida el SKU en la base de datos y agrega el artículo al carrito, actualizando el monto total de la transacción.
2. **Modificación de la Orden**: El operador puede ajustar las cantidades de los productos o eliminar ítems. El sistema recalcula el total inmediatamente.
3. **Ejecución del Pago en Efectivo**: Al seleccionar la modalidad de pago en efectivo, el operador ingresa el monto recibido. El sistema calcula la diferencia y presenta el monto del vuelto a devolver al cliente.
4. **Cierre de Transacción**: Una vez confirmada la venta, el sistema ejecuta una transacción atómica en la base de datos para registrar la orden, procesar el pago y descontar las existencias del inventario.
5. **Finalización**: El sistema emite la orden de impresión del ticket y reinicia la pantalla de ventas para la siguiente transacción.

### 4.2 Proceso de Pago Virtual (Integración Mercado Pago)
Dada la naturaleza asíncrona de los pagos digitales, el flujo se rige por la siguiente secuencia:
1. **Solicitud de Pago**: El operador selecciona la opción de pago virtual. El sistema solicita al backend la generación de un código QR dinámico.
2. **Generación del QR**: El backend se comunica con la API de Mercado Pago, crea una orden con el monto exacto y retorna los datos del QR al frontend.
3. **Presentación al Cliente**: El sistema despliega el código QR en pantalla y actualiza el estado de la interfaz a "Esperando confirmación de pago".
4. **Procesamiento del Pago**: El cliente escanea el código y completa la transacción desde su aplicación móvil. Mercado Pago procesa el pago y envía una notificación automática (Webhook) al servidor del sistema.
5. **Validación y Notificación**: El servidor recibe la notificación, verifica la validez del pago mediante una consulta directa a la API de Mercado Pago y, una vez confirmado, envía una señal en tiempo real mediante SignalR al frontend.
6. **Cierre Automático**: El sistema detecta la señal de confirmación, actualiza el estado de la venta a "Pagado" y procede a la emisión del ticket y actualización de stock.

### 4.3 Gestión del Ciclo de Vida de Caja
El control financiero se gestiona a través de las siguientes etapas:
1. **Apertura de Jornada**: El operador se autentica y registra el monto de fondo de caja inicial. El sistema crea una sesión de caja activa y registra la marca de tiempo de inicio.
2. **Operación Continua**: Todas las transacciones realizadas se vinculan obligatoriamente al identificador de la sesión de caja activa para garantizar la trazabilidad.
3. **Arqueo y Cierre**: Al finalizar el turno, el operador ingresa el monto total de efectivo físico presente en la caja. El sistema realiza una conciliación comparando el fondo inicial más las ventas en efectivo contra el monto contado.
4. **Reporte de Diferencias**: El sistema genera un reporte detallando cualquier faltante o sobrante de caja y marca la sesión como cerrada, impidiendo nuevas ventas en esa terminal hasta una nueva apertura.

### 4.4 Interacción de Gestión de Inventario
El administrador interactúa con el sistema para asegurar la disponibilidad de productos:
1. **Monitoreo de Existencias**: El administrador accede al panel de control, donde el sistema resalta los productos que han alcanzado el límite de stock crítico.
2. **Actualización de Stock**: El administrador registra el ingreso de nueva mercadería. El sistema actualiza la cantidad en la base de datos y emite una notificación de disponibilidad a todas las terminales de venta activas.

---

## 5. Análisis de Experiencia de Usuario (UX)

### 5.1 Directrices de Diseño de Interfaz
- **Eficiencia Operativa**: Se prioriza el uso de teclado sobre el mouse mediante la implementación de atajos de teclado (Hotkeys) para las acciones más frecuentes.
- **Diseño Touch-First**: Implementación de componentes de interfaz con dimensiones amplias, optimizados para pantallas táctiles y organizados por paneles de colores según la categoría del producto.
- **Feedback Auditivo y Visual**: Implementación de señales sonoras diferenciadas para confirmar la adición de productos, errores de stock y la confirmación exitosa de pagos virtuales.

---

## 6. Diseño del Modelo de Datos (ERD)

Esta sección define la estructura de la base de datos relacional en MySQL, asegurando la integridad y consistencia de la información.

### 6.1 Diccionario de Datos

#### Módulo de Identidad y Acceso
- **`Roles`**: Almacena los niveles de acceso del sistema.
  - `id` (INT, PK, AI)
  - `nombre` (VARCHAR) $\rightarrow$ Ej: 'Admin', 'Cajero'.
- **`Users`**: Almacena la información de los operadores.
  - `id` (INT, PK, AI)
  - `username` (VARCHAR, Unique)
  - `password_hash` (VARCHAR)
  - `role_id` (INT, FK $\rightarrow$ `Roles.id`)
  - `is_active` (BOOLEAN)

#### Módulo de Catálogo y Almacén
- **`Categories`**: Clasificación de productos.
  - `id` (INT, PK, AI)
  - `nombre` (VARCHAR)
  - `descripcion` (TEXT)
- **`Products`**: Maestro de artículos.
  - `id` (INT, PK, AI)
  - `sku` (VARCHAR, Unique) $\rightarrow$ Código de barras.
  - `nombre` (VARCHAR)
  - `descripcion` (TEXT)
  - `precio` (DECIMAL 10,2)
  - `category_id` (INT, FK $\rightarrow$ `Categories.id`)
  - `stock_actual` (INT)
  - `stock_minimo` (INT) $\rightarrow$ Disparador de alertas.
- **`InventoryLogs`**: Historial de movimientos de stock.
  - `id` (INT, PK, AI)
  - `product_id` (INT, FK $\rightarrow$ `Products.id`)
  - `user_id` (INT, FK $\rightarrow$ `Users.id`)
  - `cantidad_cambio` (INT) $\rightarrow$ Positivo para ingresos, negativo para ventas/mermas.
  - `motivo` (VARCHAR) $\rightarrow$ Ej: 'Venta', 'Carga de Stock', 'Ajuste'.
  - `fecha` (DATETIME)

#### Módulo de Transacciones
- **`Orders`**: Cabecera de la venta.
  - `id` (INT, PK, AI)
  - `session_id` (INT, FK $\rightarrow$ `CashSessions.id`)
  - `user_id` (INT, FK $\rightarrow$ `Users.id`)
  - `total` (DECIMAL 10,2)
  - `fecha` (DATETIME)
  - `estado` (VARCHAR) $\rightarrow$ 'Pendiente', 'Pagado', 'Anulado'.
- **`OrderItems`**: Detalle de la venta.
  - `id` (INT, PK, AI)
  - `order_id` (INT, FK $\rightarrow$ `Orders.id`)
  - `product_id` (INT, FK $\rightarrow$ `Products.id`)
  - `cantidad` (INT)
  - `precio_unitario` (DECIMAL 10,2) $\rightarrow$ Precio al momento de la venta.
  - `subtotal` (DECIMAL 10,2)
- **`Payments`**: Registro de cobros.
  - `id` (INT, PK, AI)
  - `order_id` (INT, FK $\rightarrow$ `Orders.id`)
  - `metodo_pago` (VARCHAR) $\rightarrow$ 'Efectivo', 'MercadoPago'.
  - `monto` (DECIMAL 10,2)
  - `transaction_id` (VARCHAR, Nullable) $\rightarrow$ ID de transacción de Mercado Pago.
  - `fecha` (DATETIME)

#### Módulo Financiero
- **`CashSessions`**: Control de turnos de caja.
  - `id` (INT, PK, AI)
  - `user_id` (INT, FK $\rightarrow$ `Users.id`)
  - `monto_apertura` (DECIMAL 10,2)
  - `monto_cierre_sistema` (DECIMAL 10,2) $\rightarrow$ Suma de ventas + apertura.
  - `monto_cierre_fisico` (DECIMAL 10,2) $\rightarrow$ Monto contado por el cajero.
  - `estado` (VARCHAR) $\rightarrow$ 'Abierta', 'Cerrada'.
  - `fecha_apertura` (DATETIME)
  - `fecha_cierre` (DATETIME)

---

## 7. Especificaciones Técnicas y Arquitectura

### 7.1 Diagrama de Interacción Técnica
`React (Client)` $\longleftrightarrow$ `ASP.NET Core (API)` $\longleftrightarrow$ `MySQL (DB)`
$\quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \updownarrow$
$\quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \quad \text{Mercado Pago API}$

### 7.2 Atributos de Calidad
- **Seguridad**: Implementación de JWT para autenticación y almacenamiento de secretos en variables de entorno.
- **Escalabilidad**: Arquitectura desacoplada (Frontend/Backend) que permite escalar el servidor de API independientemente de las terminales de venta.
- **Fiabilidad**: Uso de transacciones SQL para asegurar que no existan ventas sin pago o descuentos de stock fallidos.
