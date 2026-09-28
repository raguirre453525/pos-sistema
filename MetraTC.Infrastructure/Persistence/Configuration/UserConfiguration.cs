using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configuration;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Username)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(u => u.Username)
            .IsUnique();

        builder.Property(u => u.FullName)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(u => u.PasswordHash)
            .IsRequired();

        builder.Property(u => u.Role)
            .HasConversion<string>()
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(u => u.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(u => u.CreatedAt)
            .IsRequired();

        builder.HasOne(u => u.Business)
            .WithMany(b => b.Users)
            .HasForeignKey(u => u.BusinessId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        builder.HasIndex(u => u.BusinessId);
        builder.HasIndex(u => u.Role);

        // Seed data with fixed Guids - PasswordHasher hashes for superadmin123 / admin123 / cajero123
        // Generated via Microsoft.AspNetCore.Identity.PasswordHasher<User> - verify with VerifyHashedPassword
        // Passwords: superadmin123, admin123, cajero123
        // Hashes contain random salt and are V3 Identity hashes (PBKDF2)
        builder.HasData(
            new User
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                BusinessId = null,
                Username = "superadmin",
                PasswordHash = "AQAAAAIAAYagAAAAEEGuJ/JV366gv5+li5dUOQ0+PMbu8bFCO3qjlFI8ktgZcdd5qc5g7L5uLVQBxACaXQ==",
                FullName = "Super Admin",
                Role = MetraTC.Domain.Enums.UserRole.SuperAdmin,
                IsActive = true,
                CreatedAt = new DateTime(2026, 01, 01, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                BusinessId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                Username = "admin",
                PasswordHash = "AQAAAAIAAYagAAAAELtJ86TEJl8lXsvJpddNNYmTmTz5dtR8zflx67izQD6gxbYAoSn6bfPKUTSRrDjOFw==",
                FullName = "Admin Repuestera",
                Role = MetraTC.Domain.Enums.UserRole.Admin,
                IsActive = true,
                CreatedAt = new DateTime(2026, 01, 01, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                BusinessId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                Username = "cajero",
                PasswordHash = "AQAAAAIAAYagAAAAEBLfRvQSz32027IEO4FYdU3oF2ogMgdR4i4hMBgbmU0sR7R8GnmjGJOmJHWqpeO70Q==",
                FullName = "Cajero",
                Role = MetraTC.Domain.Enums.UserRole.User,
                IsActive = true,
                CreatedAt = new DateTime(2026, 01, 01, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
