using MetraTC.Domain.Common;
using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Text;

namespace MetraTC.Domain.Interfaces;

public interface IRepository<T> where T : BaseEntity
{
    Task<IEnumerable<T>> GetAllAsync(params string[] includeProperties);
    Task<T?> GetByIdAsync(Guid id, params string[] includeProperties);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, params string[] includeProperties);
    Task<T> AddAsync(T entity);
    Task<T> UpdateAsync(T entity);
    Task<T> DeleteAsync(T entity);
}
