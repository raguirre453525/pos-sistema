namespace MetraTC.Domain.Common;

public class ConflictException : InvalidOperationException
{
    public ConflictException(string message) : base(message) { }
}
