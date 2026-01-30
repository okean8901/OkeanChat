# MẪU BÁO CÁO BUG (BUG REPORT TEMPLATE)

---

## BUG #001

**Bug ID:** BUG-001  
**Tiêu đề:** Không thể gửi tin nhắn trong channel sau 5 phút kết nối

**Thông Tin Cơ Bản:**
- **Mô tả lỗi:** Sau khi vào channel 5 phút, nút Send tin nhắn bị vô hiệu hóa. Không thể gửi bất kỳ tin nhắn nào cho đến khi refresh trang.
- **Mức độ nghiêm trọng:** High
- **Trạng thái:** Open
- **Người tạo:** QA Engineer 1
- **Người xử lý:** Dev 2
- **Ngày tạo:** 02/02/2026
- **Ngày cập nhật:** 02/02/2026

**Môi Trường Test:**
- **Trình duyệt:** Chrome 122.0
- **Hệ điều hành:** Windows 11 Pro
- **URL:** http://localhost:5000/home/chat
- **Tài khoản test:** testuser1 / testpass123
- **Build/Version:** 1.0.0-beta.1

**Bước Tái Hiện Lỗi:**
1. Đăng nhập với tài khoản testuser1
2. Vào channel "general"
3. Chờ 5 phút mà không gửi tin nhắn
4. Cố gắng gửi tin nhắn mới
5. Nút Send không hoạt động

**Kết Quả Mong Đợi:**
- Người dùng có thể gửi tin nhắn bất kỳ lúc nào
- Nút Send luôn hoạt động nếu có nội dung tin nhắn

**Kết Quả Thực Tế:**
- Nút Send bị disable (màu xám, không click được)
- Console hiển thị lỗi: "WebSocket connection timeout"
- Khi refresh trang, lại có thể gửi bình thường

**Screenshot/Video:**
[Đính kèm screenshot hoặc video]

**Nhật ký Console:**
```
[Error] WebSocket connection timeout after 5 minutes
[Error] SignalR reconnection failed: max retries exceeded
```

**Ghi Chú Thêm:**
- Lỗi này xảy ra 100% lần
- Có thể liên quan đến WebSocket timeout
- Cần check server-side logs
- User report đây là lỗi phổ biến

**Gán Cho:** Dev 2 - Backend Team

---

## BUG #002

**Bug ID:** BUG-002  
**Tiêu đề:** Avatar bị lỗi hiển thị khi upload ảnh > 5MB

**Thông Tin Cơ Bản:**
- **Mô tả lỗi:** Khi upload avatar có size > 5MB, ảnh không hiển thị, chỉ thấy icon mặc định
- **Mức độ nghiêm trọng:** Medium
- **Trạng thái:** Open
- **Người tạo:** QA Engineer 2
- **Người xử lý:** Dev 1
- **Ngày tạo:** 02/02/2026
- **Ngày cập nhật:** 02/02/2026

**Môi Trường Test:**
- **Trình duyệt:** Firefox 123.0
- **Hệ điều hành:** Windows 11 Pro
- **URL:** http://localhost:5000/account/profile
- **Tài khoản test:** testuser2 / testpass123
- **Build/Version:** 1.0.0-beta.1

**Bước Tái Hiện Lỗi:**
1. Đăng nhập vào Account/Profile
2. Click "Upload Avatar"
3. Chọn ảnh có size 6MB
4. Ấn Save
5. Xem lại profile

**Kết Quả Mong Đợi:**
- Avatar được upload thành công
- Hoặc hiện thông báo lỗi rõ ràng (max 5MB)
- Avatar hiển thị đúng

**Kết Quả Thực Tế:**
- Avatar không hiển thị (chỉ thấy icon mặc định)
- Không có thông báo lỗi nào
- Khi check network, request gửi thành công (200 OK)
- Nhưng file không được lưu đúng

**Screenshot/Video:**
[Đính kèm screenshot]

**Ghi Chú Thêm:**
- Size ảnh được chấp nhận là bao nhiêu?
- Cần thêm validation client-side
- File manager: /avatars/ có file không?

**Gán Cho:** Dev 1 - Frontend Team

---

## BUG #003

**Bug ID:** BUG-003  
**Tiêu đề:** Cuộc gọi video không có âm thanh từ đầu khác

**Thông Tin Cơ Bản:**
- **Mô tả lỗi:** Trong cuộc gọi video giữa 2 người, một người không nghe được âm thanh từ đầu kia mặc dù hình ảnh bình thường
- **Mức độ nghiêm trọng:** Critical
- **Trạng thái:** Open
- **Người tạo:** QA Engineer 1
- **Người xử lý:** Dev 3 - WebRTC Team
- **Ngày tạo:** 03/02/2026
- **Ngày cập nhật:** 03/02/2026

**Môi Trường Test:**
- **Trình duyệt:** Chrome 122.0 + Chrome 122.0 (2 users)
- **Hệ điều hành:** Windows 11 Pro (cả 2)
- **URL:** http://localhost:5000
- **Tài khoản test:** testuser1, testuser2
- **Micro:** Logitech USB Headset (cả 2)
- **Build/Version:** 1.0.0-beta.1

**Bước Tái Hiện Lỗi:**
1. User 1 và User 2 cùng vào chat
2. User 1 gọi User 2
3. User 2 nhận và chấp nhận
4. Cuộc gọi kết nối
5. User 2 không nghe được âm thanh từ User 1

**Kết Quả Mong Đợi:**
- Cả 2 đều nghe được âm thanh từ nhau
- Micro hoạt động bình thường
- Có indicator khi có âm thanh

**Kết Quả Thực Tế:**
- Video bình thường (User 2 thấy User 1 nói)
- Nhưng User 2 không nghe tiếng gì
- Kiểm tra: browser permission cho micro: OK, micro active: OK
- Console không có lỗi

**Nhật ký Browser (Console):**
```
WebRTC connected
Audio tracks: 0
Video tracks: 1
```

**Ghi Chú Thêm:**
- Xảy ra trên 3 lần test liên tiếp
- Khi restart call, lần 2 có âm thanh bình thường
- Có thể là lỗi khởi tạo audio stream

**Gán Cho:** Dev 3 - WebRTC Team

---

## BUG #004

**Bug ID:** BUG-004  
**Tiêu đề:** Lỗi "Permission denied" khi access friends API từ client

**Thông Tin Cơ Bản:**
- **Mô tả lỗi:** API endpoint `/api/friend/search` trả về 403 Permission denied mặc dù user đã đăng nhập
- **Mức độ nghiêm trọng:** High
- **Trạng thái:** In Progress (Đang xử lý)
- **Người tạo:** QA Engineer 2
- **Người xử lý:** Dev 2
- **Ngày tạo:** 03/02/2026
- **Ngày cập nhật:** 04/02/2026

**Môi Trường Test:**
- **Phương pháp:** API Testing (Postman)
- **Endpoint:** GET /api/friend/search?username=test
- **Build/Version:** 1.0.0-beta.1

**Bước Tái Hiện Lỗi:**
1. Đăng nhập thành công (có token JWT)
2. Copy token vào Postman header
3. Gửi request: GET /api/friend/search?username=test
4. Nhận response 403

**Response:**
```json
{
  "statusCode": 403,
  "message": "Permission denied",
  "error": "Forbidden"
}
```

**Ghi Chú Thêm:**
- Endpoint khác hoạt động bình thường
- Token hợp lệ và không hết hạn
- Có thể là issue authorize attribute

**Fix Status (Dev ghi):**
- Ngày fix: 04/02/2026
- Commit: 8f3d2a1 - Fixed FriendController authorization
- Cần retest

---

## BUG #005

**Bug ID:** BUG-005  
**Tiêu đề:** Chat bị lag khi 50+ tin nhắn load cùng lúc

**Thông Tin Cơ Bản:**
- **Mô tả lỗi:** Khi mở channel cũ có 50+ tin nhắn, giao diện bị lag, scroll chậm, input delay
- **Mức độ nghiêm trọng:** Medium
- **Trạng thái:** Open
- **Người tạo:** QA Engineer 1
- **Người xử lý:** Dev 1 - Frontend Performance
- **Ngày tạo:** 04/02/2026
- **Ngày cập nhật:** 04/02/2026

**Môi Trường Test:**
- **Trình duyệt:** Chrome 122.0
- **Hệ điều hành:** Windows 11 Pro (i7, 16GB RAM)
- **URL:** http://localhost:5000/home/chat
- **Build/Version:** 1.0.0-beta.1

**Bước Tái Hiện Lỗi:**
1. Mở channel có 100 tin nhắn
2. Scroll lên để load thêm tin cũ
3. Ghi chú lag, FPS drop

**Performance Metrics (Chrome DevTools):**
- Frame rate: 15-20 FPS (bình thường: 60 FPS)
- Main thread work: 800ms
- Rendering time: 600ms
- Rendering lag: 400ms

**Ghi Chú Thêm:**
- Cần tối ưu rendering
- Có thể dùng virtual scrolling
- Memory usage: 150MB (cao)

---

## Hướng Dẫn Điền Bug Report

### Thông Tin Bắt Buộc:
1. **Bug ID:** Mã định danh duy nhất (BUG-XXX)
2. **Tiêu đề:** Tóm tắt bug trong 1-2 dòng
3. **Mô tả lỗi:** Chi tiết, dễ hiểu
4. **Mức độ nghiêm trọng:** Critical / High / Medium / Low
5. **Bước Tái Hiện:** Danh sách chi tiết từng bước
6. **Kết Quả Mong Đợi vs Thực Tế:** Rõ ràng so sánh

### Thông Tin Hữu Ích (nên có):
- Screenshot/Video
- Browser console logs
- Network logs
- Tài khoản/Data test
- Môi trường test
- Tần suất xảy ra (100%, 50%, ...)

### Trạng Thái Bug:
- **Open:** Vừa tạo, chưa ai nhận
- **In Progress:** Đang xử lý
- **Fixed:** Đã fix, chờ retest
- **Retest:** Đã fix, đang retest
- **Closed:** Fix xong, test passed
- **Reopened:** Fix không thành công, reopen
- **Wontfix:** Không fix (by-design hoặc low priority)
- **Duplicate:** Trùng với bug khác

### Tips:
- Viết rõ ràng, đơn giản, không viết tắt
- Không dùng từ mơ hồ ("kỳ lạ", "lạ")
- Gửi report ngay khi phát hiện bug
- Cập nhật trạng thái nếu có thay đổi
- Attach logs/screenshots/video nếu có
