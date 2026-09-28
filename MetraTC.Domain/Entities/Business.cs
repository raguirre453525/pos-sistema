namespace MetraTC.Domain.Entities;

public class Business
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Cuit { get; set; }
    public bool IsActive { get; set; } = true;

    // Feature flags — all default true per spec
    public bool ModuloClientes { get; set; } = true;
    public bool ModuloPromos { get; set; } = true;
    public bool ModuloReportes { get; set; } = true;
    public bool PermitirAjusteInflacion { get; set; } = true;

    public ICollection<User> Users { get; set; } = new List<User>();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
