using MetraTC.Domain.Common;
using MetraTC.Domain.Interfaces;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace MetraTC.Infrastructure.Repositories;
public class BaseRepository<T> : IRepository<T> where T : BaseEntity
{
    private readonly ApplicationDbContext _context;
    private readonly DbSet<T> _dbSet;

    public BaseRepository(ApplicationDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public async Task<IEnumerable<T>> GetAllAsync(params string[] includeProperties)
    {
        return await ApplyIncludes(_dbSet.AsNoTracking(), includeProperties).ToListAsync();
    }

    public async Task<T?> GetByIdAsync(Guid id, params string[] includeProperties)
    {
        return await ApplyIncludes(_dbSet.AsNoTracking(), includeProperties).Where(x => x.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, params string[] includeProperties)
    {
        return await ApplyIncludes(_dbSet.AsNoTracking(), includeProperties).Where(predicate).ToListAsync();
    }

    public async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();

        return entity;
    }

    public async Task<T> UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync();

        return entity;
    }

    public async Task<T> DeleteAsync(T entity)
    {
        _dbSet.Remove(entity);
        await _context.SaveChangesAsync();

        return entity;
    }

    private static IQueryable<T> ApplyIncludes(IQueryable<T> query, string[] includes)
    {
        var queryBody = query;

        foreach (var include in includes)
        {
            if (!string.IsNullOrEmpty(include))
            {
                queryBody = queryBody.Include(include);
            }
        }

        return queryBody;
    }
}