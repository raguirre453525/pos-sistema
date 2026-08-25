using MetraTC.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace MetraTC.Domain.Entities;

public class Category : BaseEntity
{
    public string Name { get; private set; }
    public string? Description { get; private set; }

    public ICollection<Product> Products { get; private set; } = new List<Product>();

    public Category(string name, string? description = null)
    {
        ValidateData(name, description);

        Name = name;
        Description = string.IsNullOrWhiteSpace(description) ? null : description;
    }

    public void Update(string name, string? description = null)
    {
        ValidateData(name, description);

        Name = name;
        Description = string.IsNullOrWhiteSpace(description) ? null : description;
    }

    private static void ValidateData(string name, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre es requerido", nameof(name));
        if (name.Length > 100)
            throw new ArgumentException("El nombre no puede exceder los 100 caracteres");
        if (!string.IsNullOrWhiteSpace(description) && description!.Length > 500)
            throw new ArgumentException("La descripción no puede exceder los 500 caracteres");
    }
}
