# KẾ HOẠCH KIỂM THỬ (TEST PLAN) - OkeanChat

## 1. Thông Tin Chung

**Dự án:** OkeanChat - Ứng dụng Chat & Cuộc Gọi Video  
**Phiên bản:** 1.0.0  
**Ngày lập kế hoạch:** 30/01/2026  
**Ngày bắt đầu test:** 01/02/2026  
**Ngày kết thúc test:** 15/02/2026  

## 2. Mục Tiêu Test

- Xác minh tất cả chức năng hoạt động đúng theo yêu cầu
- Phát hiện và ghi lại các lỗi (bug) trong hệ thống
- Đảm bảo hiệu suất ứng dụng chấp nhận được
- Kiểm tra bảo mật cơ bản
- Xác nhận tương thích với các trình duyệt chính
- Đánh giá trải nghiệm người dùng (UX)

## 3. Phạm Vi Test (Scope)

### Các chức năng sẽ test:

**In Scope (Bao gồm):**
- Đăng ký, đăng nhập, đăng xuất
- Gửi/nhận tin nhắn trong channel
- Quản lý danh sách bạn bè
- Cuộc gọi video/voice 1-1 và group
- Thông báo real-time
- Cập nhật profile
- Lịch sử chat

**Out of Scope (Không bao gồm):**
- Tích hợp thanh toán
- Admin panel
- API performance test (load test > 1000 concurrent users)
- Localization (ngôn ngữ khác)

## 4. Môi Trường Test

### Server:
- Hệ điều hành: Windows Server 2022 / Linux Ubuntu 22.04
- Runtime: .NET 7.0+
- Database: SQL Server / PostgreSQL
- Memory: 4GB RAM tối thiểu
- Storage: 50GB SSD

### Client (End-user):
- Windows 10/11
- macOS 12+
- Linux Ubuntu 22.04+
- iOS 14+ (nếu có mobile version)
- Android 10+ (nếu có mobile version)

### Trình duyệt:
- Google Chrome (phiên bản mới nhất)
- Mozilla Firefox (phiên bản mới nhất)
- Safari (phiên bản mới nhất)
- Microsoft Edge (phiên bản mới nhất)

### Kết nối mạng:
- Tốc độ: 10 Mbps+ (cho video call)
- Latency: < 50ms (để test real-time features)

## 5. Công Cụ & Tài Nguyên

### Công cụ Test:

| Công cụ | Mục đích | Phiên bản |
|---------|---------|----------|
| Selenium / Playwright | Automated UI Test | Latest |
| Postman | API Testing | v10.x |
| Chrome DevTools | Performance, Debug | Latest |
| OWASP ZAP | Security Testing | Latest |
| JMeter | Load Testing | 5.x |
| Google Sheets | Test Case Management | - |
| Google Docs | Documentation | - |

### Tài Nguyên Con Người:

| Vị trí | Số lượng | Trách nhiệm |
|-------|---------|-----------|
| QA Lead | 1 | Quản lý test, review kết quả |
| QA Engineer | 2 | Thực hiện manual test |
| QA Automation | 1 | Viết automated test |
| Dev Support | 1 | Hỗ trợ debug khi cần |

## 6. Chiến Lược Test

### Loại Test:

1. **Functional Test (Kiểm thử chức năng)**
   - Test tất cả chức năng chính
   - Dạng: Manual + Automated
   - Độ ưu tiên: Cao

2. **Integration Test (Kiểm thử tích hợp)**
   - Test tương tác giữa modules (Chat-Friends, Call-Notification, v.v.)
   - Dạng: Manual + Automated
   - Độ ưu tiên: Cao

3. **Performance Test (Kiểm thử hiệu suất)**
   - Test tốc độ load trang, gửi tin nhắn
   - Test quy mô: 100-500 users
   - Dạng: Automated
   - Độ ưu tiên: Trung

4. **Security Test (Kiểm thử bảo mật)**
   - SQL Injection, XSS, CSRF
   - Authentication/Authorization
   - Dạng: Manual + Tools (OWASP ZAP)
   - Độ ưu tiên: Cao

5. **Usability Test (Kiểm thử trải nghiệm)**
   - UI dễ sử dụng, responsive
   - Dạng: Manual
   - Độ ưu tiên: Trung

6. **Compatibility Test (Kiểm thử tương thích)**
   - Các trình duyệt, OS
   - Dạng: Manual
   - Độ ưu tiên: Trung

### Phương pháp Test:

- **Manual Testing**: Kiểm tra bằng tay cho các chức năng phức tạp
- **Automated Testing**: Script tự động cho regression test
- **API Testing**: Kiểm tra direct API endpoints
- **End-to-End Testing**: Test toàn bộ user journey

## 7. Tiêu Chí Vào Test (Entry Criteria)

✓ Code đã được review bởi developers  
✓ Build environment sẵn sàng  
✓ Database đã được setup  
✓ Test data đã được chuẩn bị  
✓ Test cases đã được approve  

## 8. Tiêu Chí Ra Test (Exit Criteria)

✓ Đã test 100% test cases được lập  
✓ Critical bugs phải được fix (severity High+)  
✓ Pass rate >= 95%  
✓ Performance test passed  
✓ Security test passed  
✓ Test report được approve bởi lead  

## 9. Lịch Trình Test (Timeline)

| Giai đoạn | Thời gian | Công việc |
|-----------|----------|----------|
| Chuẩn bị | 01-02/02 | Setup environment, tạo test data |
| Smoke Test | 03-04/02 | Kiểm tra các chức năng cơ bản |
| Functional Test | 05-09/02 | Test tất cả chức năng |
| Integration Test | 10-11/02 | Test tương tác giữa modules |
| Performance & Security | 12/02 | Load test, security test |
| Regression Test | 13/02 | Test lại các bug đã fix |
| Final Test | 14/02 | Final check trước release |
| Report | 15/02 | Hoàn thành test report |

## 10. Tiêu Chuẩn Lỗi (Bug Severity)

| Mức độ | Định nghĩa | Ví dụ | Thời gian fix |
|-------|-----------|--------|----------------|
| Critical | Ứng dụng crash, mất dữ liệu | Không thể đăng nhập | ASAP (< 2h) |
| High | Tính năng chính không hoạt động | Chat không gửi được tin | < 24h |
| Medium | Tính năng phụ lỗi, có workaround | Avatar không load | < 48h |
| Low | UI nhỏ, typo, hiệu ứng lỗi | Nút bị lệch 1px | < 1 tuần |

## 11. Quản Lý Rủi Ro (Risk Management)

| Rủi ro | Ảnh hưởng | Xác suất | Giảm thiểu |
|--------|----------|---------|-----------|
| Delay release | High | Medium | Start test sớm, prioritize |
| WebRTC không hoạt động | High | Low | Test sớm trên browsers khác nhau |
| Database performance | High | Medium | Setup proper indexing, load test |
| Network latency issue | Medium | Medium | Test trên nhiều network conditions |
| Browser compatibility | Medium | Low | Test trên browsers chính |

## 12. Escallation Process

1. Tester phát hiện bug → Ghi lại với chi tiết
2. Nếu Critical → Inform QA Lead ngay
3. QA Lead xác nhận, assign cho Dev
4. Dev fix → Push fix → Tester retest
5. Nếu không thể fix trong time → Escalate lên Manager

## 13. Approval & Sign-off

- QA Lead: _________________________ Ngày: _______
- Dev Lead: _________________________ Ngày: _______
- Project Manager: __________________ Ngày: _______

---

**Ghi chú:**
- Kế hoạch này có thể điều chỉnh tuỳ theo tình hình thực tế
- Mọi thay đổi phải được thông báo cho toàn bộ team
