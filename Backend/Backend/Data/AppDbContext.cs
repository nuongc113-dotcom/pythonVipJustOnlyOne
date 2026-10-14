using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data
{
    /// <summary>
    /// DbContext kết nối cơ sở dữ liệu SQLite cho hệ thống điểm danh
    /// </summary>
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        /// <summary>
        /// Bảng People lưu danh sách người và vector khuôn mặt
        /// </summary>
        public DbSet<Person> People { get; set; } = null!;

        /// <summary>
        /// Bảng AttendanceRecords lưu lịch sử các lần điểm danh
        /// </summary>
        public DbSet<AttendanceRecord> AttendanceRecords { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Cấu hình bảng People
            modelBuilder.Entity<Person>(entity =>
            {
                entity.ToTable("People");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(150);
                entity.Property(e => e.FaceVectorJson).IsRequired();
            });

            // Cấu hình bảng AttendanceRecords
            modelBuilder.Entity<AttendanceRecord>(entity =>
            {
                entity.ToTable("AttendanceRecords");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.PersonName).IsRequired().HasMaxLength(150);
            });
        }
    }
}
