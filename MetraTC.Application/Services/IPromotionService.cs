using static MetraTC.Application.DTOs.PromotionDtos;

namespace MetraTC.Application.Services;

public interface IPromotionService
{
    Task<PromotionDto> CreateAsync(CreatePromotionDto dto, Guid businessId);
    Task<PromotionDto> UpdateAsync(Guid id, UpdatePromotionDto dto, Guid businessId);
    Task DeleteAsync(Guid id, Guid businessId);
    Task<IEnumerable<PromotionDto>> GetAllAsync(Guid businessId);
    Task<IEnumerable<PromotionDto>> GetActiveAsync(Guid businessId);
    Task<PromotionDto> GetByIdAsync(Guid id, Guid businessId);
    Task<PromotionDto> ToggleActiveAsync(Guid id, Guid businessId);
}
