using MetraTC.Domain.Enums;

namespace MetraTC.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public Guid? BusinessId { get; set; }
    public Business? Business { get; set; }
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
