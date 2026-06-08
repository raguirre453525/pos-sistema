using System;
using System.Collections.Generic;
using System.Text;

namespace MetraTC.Domain.Enums;

public enum OrderStatus
{
    Pending = 1,    // Esperando pago o confirmación
    Completed = 2,  // Venta finalizada y cobrada
    Cancelled = 3   // Venta anulada
}
