using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configurations;

public class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("Sales");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Date)
            .IsRequired();

        builder.Property(s => s.PaymentMethod)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(s => s.Total)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(s => s.IsCredit).IsRequired().HasDefaultValue(false);
        builder.Property(s => s.PaidAmount).HasColumnType("decimal(18,2)").IsRequired().HasDefaultValue(0m);
        builder.Property(s => s.CustomerId).IsRequired(false);
        builder.HasOne(s => s.Customer).WithMany().HasForeignKey(s => s.CustomerId).OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(s => s.CustomerId);
        builder.HasIndex(s => s.IsCredit);

        builder.HasMany(s => s.Items)
            .WithOne(i => i.Sale)
            .HasForeignKey(i => i.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        // No HasQueryFilter: las ventas son registros históricos.
        // Ocultar IsActive=false ocultaría ventas anuladas del historial.
    }
}
