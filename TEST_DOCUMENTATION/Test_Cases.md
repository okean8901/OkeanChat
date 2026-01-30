# BẢNG TEST CASE - OkeanChat

## Phần 1: Chức Năng Đăng Nhập & Đăng Ký

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC01 | Đăng ký tài khoản với thông tin hợp lệ | Nhập username, email, password, confirm password rồi ấn Register | Tài khoản được tạo, chuyển hướng đến trang login | | | |
| TC02 | Đăng ký với username đã tồn tại | Nhập username trùng lặp | Hiện thông báo lỗi "Username already exists" | | | |
| TC03 | Đăng ký với email không hợp lệ | Nhập email sai format | Hiện thông báo lỗi về định dạng email | | | |
| TC04 | Đăng ký với password quá yếu | Nhập password ngắn < 6 ký tự | Hiện lỗi yêu cầu password mạnh hơn | | | |
| TC05 | Đăng ký nhưng confirm password không khớp | Nhập password khác confirm password | Hiện lỗi "Passwords do not match" | | | |
| TC06 | Đăng nhập với tài khoản hợp lệ | Nhập đúng username/email và password | Đăng nhập thành công, chuyển đến trang Chat | | | |
| TC07 | Đăng nhập với password sai | Nhập đúng username, sai password | Hiện thông báo lỗi "Invalid credentials" | | | |
| TC08 | Đăng nhập với tài khoản không tồn tại | Nhập username/email không tồn tại | Hiện thông báo lỗi "User not found" | | | |
| TC09 | Đăng nhập nhưng để trống username | Ấn login mà không nhập username | Hiện lỗi yêu cầu nhập username | | | |
| TC10 | Đăng nhập nhưng để trống password | Ấn login mà không nhập password | Hiện lỗi yêu cầu nhập password | | | |
| TC11 | Logout thành công | Ấn nút Logout | Đăng xuất, chuyển đến trang login | | | |
| TC12 | Kiểm tra remember me | Đăng nhập và check "Remember me" | Lần sau truy cập không cần login lại | | | |

## Phần 2: Chức Năng Chat

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC20 | Gửi tin nhắn trong channel | Nhập tin nhắn, ấn Send | Tin nhắn hiển thị trong chat, có timestamp | | | |
| TC21 | Hiển thị tên người dùng và avatar | Gửi tin nhắn | Hiển thị đúng username và avatar của user | | | |
| TC22 | Nhận tin nhắn real-time | 2 user cùng vào channel, user A gửi tin | User B nhận được tin ngay lập tức | | | |
| TC23 | Lấy lịch sử tin nhắn | Vào channel có tin nhắn cũ | Hiển thị các tin nhắn trước đó (phân trang) | | | |
| TC24 | Gửi tin nhắn rỗng | Ấn Send mà không nhập nội dung | Không gửi, hiện lỗi | | | |
| TC25 | Gửi tin nhắn quá dài | Gửi tin nhắn > 5000 ký tự | Cắt ngắn hoặc hiện cảnh báo | | | |
| TC26 | Chỉnh sửa tin nhắn | Ấn Edit trên tin nhắn của mình | Tin nhắn được chỉnh sửa, đánh dấu "Edited" | | | |
| TC27 | Xóa tin nhắn của mình | Ấn Delete trên tin nhắn của mình | Tin nhắn bị xóa khỏi chat | | | |
| TC28 | Không thể xóa tin nhắn của người khác | Cố gắng xóa tin nhắn user khác | Hiện lỗi "Permission denied" | | | |
| TC29 | Xem danh sách channel | Vào trang Chat | Hiển thị tất cả các channel hoạt động | | | |
| TC30 | Tìm kiếm channel | Dùng search box tìm channel | Hiển thị kết quả tìm kiếm phù hợp | | | |

## Phần 3: Quản Lý Bạn Bè

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC40 | Tìm kiếm người dùng | Nhập ít nhất 3 ký tự vào search | Hiển thị danh sách user khớp | | | |
| TC41 | Gửi lời mời kết bạn | Tìm user và ấn "Add Friend" | Lời mời được gửi, user kia nhận thông báo | | | |
| TC42 | Chấp nhận lời mời kết bạn | User nhận lời mời, ấn Accept | 2 user trở thành bạn bè | | | |
| TC43 | Từ chối lời mời kết bạn | User nhận lời mời, ấn Reject | Lời mời bị từ chối | | | |
| TC44 | Xem danh sách bạn bè | Vào phần Friends | Hiển thị tất cả bạn bè | | | |
| TC45 | Xóa bạn bè | Ấn Unfriend trên bạn bè | User bị xóa khỏi danh sách bạn | | | |
| TC46 | Xem trạng thái online | Nhìn danh sách bạn | Hiển thị biểu tượng online/offline | | | |
| TC47 | Chat riêng với bạn | Ấn chat trên profile bạn | Mở cửa sổ chat riêng | | | |
| TC48 | Chặn người dùng | Ấn block trên profile user | User bị chặn không thể gửi tin | | | |
| TC49 | Bỏ chặn người dùng | Ấn unblock trên user bị chặn | User không còn bị chặn | | | |

## Phần 4: Cuộc Gọi Video/Voice

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC60 | Khởi tạo cuộc gọi video | Ấn nút Call trên profile bạn | Gửi yêu cầu cuộc gọi, chờ trả lời | | | |
| TC61 | Nhận cuộc gọi video | User khác gọi | Hiện thông báo cuộc gọi incoming | | | |
| TC62 | Chấp nhận cuộc gọi | Ấn Accept trên cuộc gọi incoming | Kết nối video, hiển thị 2 video feed | | | |
| TC63 | Từ chối cuộc gọi | Ấn Reject trên cuộc gọi incoming | Cuộc gọi bị từ chối | | | |
| TC64 | Hủy cuộc gọi đang thực hiện | Ấn Hang up trong cuộc gọi | Ngắt kết nối, quay lại chat | | | |
| TC65 | Tắt/bật camera trong cuộc gọi | Ấn nút camera icon | Camera bật/tắt, hiển thị trạng thái | | | |
| TC66 | Tắt/bật micro trong cuộc gọi | Ấn nút micro icon | Micro bật/tắt, hiển thị trạng thái | | | |
| TC67 | Cuộc gọi timeout | Gọi nhưng không trả lời sau 30s | Cuộc gọi bị hủy tự động | | | |
| TC68 | Cuộc gọi group | Ấn Call Group trong channel | Tất cả member nhận mời cuộc gọi | | | |
| TC69 | Chia sẻ màn hình | Ấn "Share Screen" trong cuộc gọi | Hiển thị màn hình được chia sẻ | | | |

## Phần 5: Thông Báo

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC80 | Nhận thông báo tin nhắn mới | User khác gửi tin | Hiện biểu tượng thông báo + số đếm | | | |
| TC81 | Nhận thông báo lời mời kết bạn | User gửi lời mời | Hiện thông báo "Friend request from..." | | | |
| TC82 | Nhận thông báo cuộc gọi | User gọi tới | Hiện thông báo incoming call | | | |
| TC83 | Đánh dấu thông báo là đã đọc | Click vào thông báo | Thông báo mất, số đếm giảm | | | |
| TC84 | Xóa thông báo | Ấn X trên thông báo | Thông báo bị xóa | | | |
| TC85 | Lịch sử thông báo | Vào mục Notifications | Hiển thị tất cả thông báo cũ | | | |

## Phần 6: Profile & Cài Đặt

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC100 | Xem profile của bản thân | Vào Settings > Profile | Hiển thị thông tin cá nhân | | | |
| TC101 | Cập nhật display name | Thay đổi display name, save | Display name được cập nhật | | | |
| TC102 | Cập nhật avatar | Upload avatar mới | Avatar được cập nhật trên toàn hệ thống | | | |
| TC103 | Cập nhật bio | Thay đổi bio, save | Bio được cập nhật | | | |
| TC104 | Cập nhật email | Thay đổi email | Gửi xác thực email, email được cập nhật | | | |
| TC105 | Đổi mật khẩu | Nhập old password + new password | Mật khẩu được đổi, cần login lại | | | |
| TC106 | Đổi mật khẩu nhưng old password sai | Nhập sai old password | Hiện lỗi "Invalid current password" | | | |
| TC107 | Kích hoạt 2FA | Bật 2-Factor Authentication | Hiển thị QR code để scan | | | |
| TC108 | Tắt 2FA | Tắt 2FA | Không còn yêu cầu 2FA | | | |

## Phần 7: Performance & Tương Thích

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC120 | Gửi 100 tin nhắn liên tiếp | Gửi 100 tin nhanh | Tất cả tin được gửi mà không lỗi | | | |
| TC121 | Load chat với 1000 tin nhắn | Vào channel có 1000 tin | Tải xong < 3 giây | | | |
| TC122 | Tương thích Chrome | Truy cập trên Chrome | Hiển thị bình thường | | | |
| TC123 | Tương thích Firefox | Truy cập trên Firefox | Hiển thị bình thường | | | |
| TC124 | Tương thích Safari | Truy cập trên Safari | Hiển thị bình thường | | | |
| TC125 | Tương thích mobile | Truy cập trên điện thoại | Responsive, dễ sử dụng | | | |
| TC126 | Đo độ chậm trang | Mở DevTools > Performance | Load time < 2 giây | | | |

## Phần 8: Bảo Mật

| Test Case ID | Mô tả test | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|
| TC140 | SQL Injection vào search | Nhập ' OR '1'='1 | Không lỗi, không bypass | | | |
| TC141 | XSS attack vào chat | Gửi <script>alert('xss')</script> | Script không chạy, hiển thị text | | | |
| TC142 | CSRF protection | Kiểm tra token CSRF | Tất cả form có token | | | |
| TC143 | HTTPS validation | Truy cập qua HTTPS | Kết nối an toàn | | | |
| TC144 | Không thể access dữ liệu user khác | Cố gắng access /api/user/{otherId} | Hiện lỗi 403 Forbidden | | | |
| TC145 | Rate limiting | Gửi 1000 request/1 phút | Bị block sau 100 request | | | |

---

**Hướng dẫn điền bảng:**
- **Pass/Fail**: Điền Pass hoặc Fail
- **Kết quả thực tế**: Ghi chép kết quả thực tế khi test
- **Ghi chú**: Thêm bất kỳ chi tiết nào cần lưu ý
