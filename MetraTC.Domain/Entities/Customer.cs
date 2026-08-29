using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public class Customer : BaseEntity
{
    public string Name { get; private set; }
    public string? Phone { get; private set; }
    public string? Note { get; private set; }

    private Customer()
    {
        Name = string.Empty;
    }

    public Customer(string name, string? phone, string? note)
    {
        ValidateData(name, phone, note);
        Name = name.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    public void Update(string name, string? phone, string? note)
    {
        ValidateData(name, phone, note);
        Name = name.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    private static void ValidateData(string name, string? phone, string? note)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre del cliente es obligatorio", nameof(name));
        var trimmed = name.Trim();
        if (trimmed.Length < 2 || trimmed.Length > 100)
            throw new ArgumentException("El nombre debe tener entre 2 y 100 caracteres", nameof(name));
        if (phone != null && phone.Trim().Length > 30)
            throw new ArgumentException("El teléfono no puede exceder 30 caracteres", nameof(phone));
        // Empty phone after trim is allowed -> treated as null, so validate length only
        if (!string.IsNullOrWhiteSpace(phone) && phone.Trim().Length > 30)
            throw new ArgumentException("El teléfono no puede exceder 30 caracteres", nameof(phone));
        if (phone != null && phone.Length > 30)
            throw new ArgumentException("El teléfono no puede exceder 30 caracteres", nameof(phone));
        if (note != null && note.Trim().Length > 500)
            throw new ArgumentException("La nota no puede exceder 500 caracteres", nameof(note));
        if (note != null && note.Length > 500)
            throw new ArgumentException("La nota no puede exceder 500 caracteres", nameof(note));
    }
}
