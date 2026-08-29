using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public class CustomerPayment : BaseEntity
{
    public Guid CustomerId { get; private set; }
    public Customer Customer { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public DateTime PaidAt { get; private set; }
    public string? Note { get; private set; }
    public Guid? SaleId { get; private set; }
    public Sale? Sale { get; private set; }

    private CustomerPayment()
    {
    }

    public CustomerPayment(Guid customerId, decimal amount, string? note = null, Guid? saleId = null)
    {
        if (customerId == Guid.Empty)
            throw new ArgumentException("CustomerId es obligatorio", nameof(customerId));
        if (amount <= 0)
            throw new ArgumentException("El monto debe ser mayor a 0", nameof(amount));
        if (note != null && note.Length > 500)
            throw new ArgumentException("La nota no puede exceder 500 caracteres", nameof(note));

        CustomerId = customerId;
        Amount = amount;
        PaidAt = DateTime.UtcNow;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        SaleId = saleId;
    }
}
