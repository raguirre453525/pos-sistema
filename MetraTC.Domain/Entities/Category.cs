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
        ValidateData(name);

        Name = name;
        Description = description;
    }

    public void Update(string name, string? description = null)
    {
        ValidateData(name);

        Name = name;
        Description = description;
    }

    private void ValidateData(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El SKU es obligatorio", nameof(name));
        if (name.Length > 50)
            throw new ArgumentException("El nombre no puede exceder los 50 caracteres");
    }
}
