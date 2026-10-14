using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AttendanceController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AttendanceController(AppDbContext context)
        {
            _context = context;
        }

        public class CheckInDto
        {
            public int? PersonId { get; set; }
            public string PersonName { get; set; } = string.Empty;
            public double Confidence { get; set; }
            public string? Status { get; set; }
            public string? Type { get; set; }
        }

        /// <summary>
        /// Gửi yêu cầu ghi nhận điểm danh từ client
        /// </summary>
        [HttpPost("checkin")]
        public async Task<IActionResult> CheckIn([FromBody] CheckInDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.PersonName))
            {
                return BadRequest(new { success = false, message = "Tên người điểm danh không được để trống!" });
            }

            var attendanceType = !string.IsNullOrWhiteSpace(dto.Type) 
                ? dto.Type.Trim() 
                : (!string.IsNullOrWhiteSpace(dto.Status) ? dto.Status.Trim() : "Check-in");

            var record = new AttendanceRecord
            {
                PersonId = dto.PersonId,
                PersonName = dto.PersonName.Trim(),
                Timestamp = DateTime.Now,
                Confidence = Math.Round(dto.Confidence, 1),
                Status = attendanceType
            };

            _context.AttendanceRecords.Add(record);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Ghi nhận điểm danh thành công cho: {record.PersonName}",
                record = new
                {
                    record.Id,
                    record.PersonId,
                    record.PersonName,
                    Time = record.Timestamp.ToString("HH:mm:ss"),
                    Date = record.Timestamp.ToString("dd/MM/yyyy"),
                    record.Status,
                    record.Confidence
                }
            });
        }

        /// <summary>
        /// Lấy danh sách lịch sử điểm danh gần nhất
        /// </summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
        {
            var rawList = await _context.AttendanceRecords
                .AsNoTracking()
                .OrderByDescending(r => r.Id)
                .Take(limit)
                .ToListAsync();

            var records = rawList.Select(r => new
            {
                r.Id,
                r.PersonId,
                r.PersonName,
                Time = r.Timestamp.ToString("HH:mm:ss"),
                Date = r.Timestamp.ToString("dd/MM/yyyy"),
                r.Status,
                r.Confidence
            }).ToList();

            return Ok(records);
        }
    }
}
