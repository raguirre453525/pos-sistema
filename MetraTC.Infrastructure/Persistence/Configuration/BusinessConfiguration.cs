using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configuration;

public class BusinessConfiguration : IEntityTypeConfiguration<Business>
{
    public void Configure(EntityTypeBuilder<Business> builder)
    {
        builder.ToTable("Businesses");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(b => b.Cuit)
            .HasMaxLength(20);

        builder.Property(b => b.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(b => b.ModuloClientes)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(b => b.ModuloPromos)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(b => b.ModuloReportes)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(b => b.PermitirAjusteInflacion)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.HasIndex(b => b.Name);

        builder.HasMany(b => b.Users)
            .WithOne(u => u.Business)
            .HasForeignKey(u => u.BusinessId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        // Seed data - Repuestera El Chorolqui (fixed Guid for reproducibility)
        builder.HasData(new Business
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Repuestera El Chorolqui",
            Cuit = null,
            IsActive = true,
            ModuloClientes = true,
            ModuloPromos = true,
            ModuloReportes = true,
            PermitirAjusteInflacion = true,
            CreatedAt = new DateTime(2026, 01, 01, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}
