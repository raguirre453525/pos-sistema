using System;
using System.Collections.Generic;
using System.Text;

namespace MetraTC.Domain.Common;

public class BaseEntity
{
    public Guid Id { get; init; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; init; }

    protected BaseEntity()
    {
        Id = Guid.NewGuid();
        IsActive = true;
        CreatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void Activate()
    {
        IsActive = true;
    }
}
