# Google đăng nhập cho Rookline (Next.js + Supabase)

**Nghiệm thu bổ sung 05/11/2026:** Bản build Webpack sau khi cấp đúng quyền ghi `.next` đã **PASS 23/23 trang**; kiểm thử Google OAuth giả lập trên Chromium **3/3 PASS** và kiểm thử callback/đọc session/quyền truy cập API có **34/34 PASS**. `npm run auth:check` PASS. Truy vấn hosted `auth.identities` ghi nhận **0 tài khoản Google**. Chưa thể xác nhận provider Google đã được lưu hoặc bí mật đã đổi vì Supabase Dashboard yêu cầu người quản trị đăng nhập. **Không dùng lại secret đã chia sẻ**. Người quản trị cần: (1) vào Google Cloud reset/rotate Google OAuth Client Secret; (2) đăng nhập Supabase → Authentication → Providers → Google, dán Client ID không có khoảng trắng, dán secret mới và bật provider → Save; (3) trong Google Cloud Audience/Testing, thêm Google test user nếu cần; (4) mở ứng dụng từ nhánh đã được triển khai trên Preview cho phép thử thật hoặc môi trường local, đăng nhập/đăng xuất bằng tài khoản Google thật và xác minh session/cookies, profile và quyền owner/outsider. Chỉ khi toàn bộ bước thật đạt và các release gates khác được đóng mới cân nhắc production theo quyền chủ dự án.

**Cập nhật kiểm tra 05/11/2026:** Nhánh phát triển đã qua `npm run check` (313 bài unit canonical, lint, TypeScript, build 23 trang); bản chạy Chromium nội bộ qua 127 bài / bỏ qua có điều kiện 4 bài, bao gồm 3 bài Google OAuth giả lập. Supabase endpoint bắt đầu OAuth trả HTTP 302 sang Google, nhưng **chưa có bằng chứng đăng nhập Google thực tế, callback nhận session và logout thành công**. Production `https://chessonline-hnquan.vercel.app/login` vẫn chạy phiên bản `main` cũ **chưa có nút Google**. Chỉ đưa lên production sau quy trình nghiệm thu và được phép triển khai. Khi nhập Client ID vào Supabase, bỏ ký tự trắng đầu/cuối và xuống dòng (dashboard từng báo `Client IDs should not contain spaces`), sử dụng đúng chuỗi có đuôi `.apps.googleusercontent.com`. Nếu Client Secret từng bị chia sẻ trong chat hoặc nơi công khai, hãy tạo secret mới tại Google Cloud và cập nhật Supabase trước khi dùng production.

Tài liệu này áp dụng trực tiếp cho mã nguồn `D:\Chess_online`, nhánh phát triển. Giao diện `/login` và `/register` đã có nút **Continue with Google**; callback `/auth/callback` dùng Supabase PKCE. Toàn bộ mã đã chuẩn bị để bạn chỉ cấu hình Google Cloud và Supabase. **Không dán Client Secret vào chat, mã nguồn, `.env.local` hoặc Git.**

## 1. Cấu hình hiện có và những gì bạn cần điền

| Nơi | Trường | Giá trị cần điền |
| --- | --- | --- |
| Google Cloud → Google Auth Platform → Clients | Application type | **Web application** |
| Google Cloud → Google Auth Platform → Clients | Name | `Rookline Web` (tùy chọn) |
| Google Cloud → Authorized redirect URIs | URI | `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback` (xem mục 2) |
| Supabase → Authentication → Providers → Google | Enable Google | **ON** |
| Supabase → Authentication → Providers → Google | Client ID | **DÁN GOOGLE CLIENT ID VỪA TẠO** |
| Supabase → Authentication → Providers → Google | Client Secret | **DÁN GOOGLE CLIENT SECRET VỪA TẠO** |
| Supabase → Authentication → URL Configuration | Site URL | `https://chessonline-hnquan.vercel.app` (nếu vẫn là domain chính thức) |
| Supabase → Authentication → URL Configuration | Redirect URLs | Các URL mục 3 |

Bạn **không cần Google API Key** hay thư viện `googleapis`. Đây là đăng nhập Google thông qua **Supabase Auth**. Hai thông tin `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` đã được dự án sử dụng cho email/password; giữ nguyên nếu đúng project. Không thay đổi `SUPABASE_SECRET_KEY`, không thêm khóa Google vào biến `NEXT_PUBLIC_*`.

Lưu ý: Tài liệu dự án trước đây ghi Supabase project ref `tyvczicinpjixmxgjhjn`. Hãy **đối chiếu với URL trong Supabase dashboard** trước khi điền; không sử dụng ref cũ nếu đã đổi dự án. Có thể chạy `npm run auth:check` để in chính xác callback URI từ `.env.local` hiện tại mà không hiển thị khóa bí mật.

## 2. Tạo khóa tại Google Cloud Console

1. Mở <https://console.cloud.google.com/>. Chọn đúng Google Cloud project hoặc tạo project mới `Rookline Chess`.
2. Vào **Google Auth Platform → Branding**. Chọn tên ứng dụng, email hỗ trợ, email liên hệ; hoàn thành yêu cầu thiết lập. Với trang web công khai, cung cấp domain/đường dẫn chính sách khi Google yêu cầu.
3. Mục **Audience**: chọn **External** để tài khoản Google thông thường sử dụng được. Nếu app đang **Testing**, thêm email Google của bạn vào **Test users** trước khi thử. Không cần xin scope nhạy cảm cho đăng nhập `openid`, `email`, `profile` cơ bản.
4. Mục **Clients → Create client → Web application**. Tên có thể là `Rookline Web`.
5. **Authorized redirect URIs**: dùng địa chỉ Supabase Auth, **không** dùng URL Next.js. Ví dụ nếu dashboard đúng ref đã ghi trong tài liệu:

   `https://tyvczicinpjixmxgjhjn.supabase.co/auth/v1/callback`

   Với Supabase custom domain, lấy **Callback URL** chính xác từ **Authentication → Providers → Google** trên Supabase. Đối chiếu lại trước khi Save.
6. **Authorized JavaScript origins**: thêm `http://localhost:3000` và `https://chessonline-hnquan.vercel.app` theo hướng dẫn cấu hình Supabase. Nếu có custom domain, thêm domain đó. **Không đặt URL có `/auth/callback`** vào trường JavaScript origins.
7. Chọn **Create**, sao chép **Client ID** (`...apps.googleusercontent.com`) và **Client Secret** (`GOCSPX-...`). Giữ bí mật Client Secret.

## 3. Bật provider Google trong Supabase

1. Vào <https://supabase.com/dashboard>, chọn đúng Supabase project (trùng với `NEXT_PUBLIC_SUPABASE_URL`).
2. Chọn **Authentication → Providers → Google**, bật provider, dán **Client ID** và **Client Secret** ở bước 2; **Save**. Nếu dashboard hiển thị **Callback URL**, nó phải trùng với địa chỉ đã lưu tại Google Cloud.
3. Vào **Authentication → URL Configuration**. `Site URL` của ứng dụng chính hiện được ghi là `https://chessonline-hnquan.vercel.app`; xác minh đây còn là domain đúng trước khi thay đổi cấu hình.
4. Trong **Redirect URLs**, thêm các mẫu sau cho đúng môi trường cần thử:

   - `http://localhost:3000/auth/callback?next=**`
   - `https://chessonline-hnquan.vercel.app/auth/callback?next=**`

   Callback Rookline luôn đính kèm `next` để đưa người dùng trở về trang ban đầu và thêm `provider=google` nếu đăng nhập Google. Supabase hỗ trợ wildcard `**` trong Redirect URLs; cấu hình này cho phép truy vấn `next` có đường dẫn động và tham số tiếp theo. Với email xác thực, route callback hiện cũng sử dụng `next`. Nếu dashboard hoặc chính sách dự án yêu cầu mẫu khác, kiểm tra bằng **Redirect URL validator** của Supabase trước khi mở rộng wildcard.
5. Với **Vercel Preview**, thêm riêng URL của Preview đã được chủ dự án cho phép: `https://<EXACT_PREVIEW_HOST>/auth/callback?next=**`. Tránh cho phép toàn bộ `*.vercel.app` ngoài phạm vi dự án.

**Hai callback khác nhau:**

```text
Google Cloud OAuth Redirect URI:
  https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback

Supabase Redirect URL (Next.js ứng dụng):
  https://chessonline-hnquan.vercel.app/auth/callback?next=**

Local development:
  http://localhost:3000/auth/callback?next=**
```

Chú ý: URL domain thật phải dùng **HTTPS**. Nếu ứng dụng đang sử dụng domain khác, thay mọi chỗ `chessonline-hnquan.vercel.app` bằng domain chính xác của môi trường đó.

## 4. Các file đã chuẩn bị trong dự án

| File | Mục đích |
| --- | --- |
| `src/components/AuthForm.tsx` | Nút **Continue with Google** trên `/login` và `/register`, xử lý trạng thái tải và lỗi khởi tạo |
| `src/lib/supabase/google-oauth.ts` | Tạo URL callback từ origin hiện tại; xác thực `next` để tránh chuyển ra domain lạ |
| `src/app/auth/callback/route.ts` | Hoàn tất mã PKCE bằng `exchangeCodeForSession`, chuyển về trang yêu cầu, hiển thị lỗi Google hợp lý |
| `src/app/login/page.tsx` | Hiện lỗi khi Google bị hủy hoặc callback hết hạn |
| `src/lib/supabase/client.ts` | Dùng `@supabase/ssr` browser client đang có, không đổi khóa |
| `src/lib/supabase/server.ts` | Đọc Supabase Auth cookies trong route handler, không đưa secret cho frontend |
| `scripts/check-google-oauth.mjs` | Kiểm tra biến Supabase public tồn tại và in URI cần cấu hình mà không in key |

Không cần tạo bảng mới hoặc áp dụng migration để **đăng nhập Google**: tài khoản dùng `auth.users`, và trigger `create_profile_for_user()` hiện tại tạo record `public.profiles` với username `rook_<id>`. Google có thể cung cấp tên trong `name`/`full_name` thay vì `display_name`, vì vậy tên hiển thị lúc đầu có thể để trống và dùng username mặc định. Người dùng có thể sửa qua trang profile hiện tại; nếu muốn tự động dùng Google name/avatar cần làm một thay đổi profile riêng và kiểm thử SQL/RLS trước khi áp dụng staging.

## 5. Chạy và tự kiểm tra

```powershell
cd D:\Chess_online
npm run auth:check
npm run dev
```

Mở <http://localhost:3000/login?next=%2Ffriends>. Nhấn **Continue with Google** rồi chọn tài khoản thuộc danh sách Test users (nếu Google đang Testing).

Luồng dự kiến:

```text
/login hoặc /register
  → Supabase auth.signInWithOAuth({ provider: "google" })
  → Google Account Picker
  → Google trả về Supabase /auth/v1/callback
  → Supabase trả về Rookline /auth/callback?code=...&next=...&provider=google
  → exchangeCodeForSession(code) → cookie session
  → /friends (hoặc trang next hợp lệ)
```

Sau khi thành công:

1. Vào **Supabase → Authentication → Users** để kiểm tra tài khoản vừa đăng nhập. Không có lý do để tạo tay một tài khoản `auth.users`.
2. Kiểm tra trang đích `/friends` và `/play/online` nhận diện đúng tài khoản.
3. Nhấn **Sign out**, kiểm tra không còn quyền gọi API cá nhân, rồi đăng nhập lại bằng Google.
4. Thử từ `/register?next=%2Fgames` và từ một deep-link `/login?next=%2Fgame%2F<id>`; cần trở về trang ban đầu hợp lệ.
5. Thử bấm **Cancel** trên màn hình Google; ứng dụng phải hiển thị lỗi thân thiện, không để phiên giả và không chuyển sang domain lạ.
6. Khi triển khai website công khai, cần kiểm tra lại một lượt trên domain thực và bằng tài khoản riêng khác. Kiểm thử giả lập trong Playwright không chứng minh Google Cloud/Supabase thực đã cấu hình đúng.

Chạy kiểm thử mã nguồn: `npm run check` và `npx playwright test e2e/google-oauth.spec.ts`. Các bài kiểm thử tại local có thể dùng mock OAuth authorize; đây là **kiểm thử frontend/đường dẫn**, không thay cho thử một lần đăng nhập thật.

## 6. Chẩn đoán lỗi thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| `redirect_uri_mismatch` | Google Cloud **Authorized redirect URI** phải là `https://<ref>.supabase.co/auth/v1/callback`, không phải URL Rookline. |
| `access_denied`, app chưa được xác minh | Google **Audience/Test users** và trạng thái Testing/Production; thêm đúng Gmail khi đang Testing. |
| Đăng nhập xong về localhost hoặc sai host | Supabase **Site URL**, **Redirect URLs** và domain thực tế của `redirectTo`; kiểm tra lại Vercel Preview. |
| Callback báo lỗi Google, không tạo session | Cùng trình duyệt, cùng hostname/port; không mở OAuth hai tab đồng thời; xóa cookie cũ hoặc thử cửa sổ riêng tư. Đối chiếu Supabase Auth Logs (không sao chép token). |
| Không có nút Google | Kiểm tra `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` đã được cấu hình cho bản build, chạy `npm run auth:check`, sau đó khởi động lại dev/build. |
| Google đăng nhập được nhưng API game báo `503` | Cấu hình phía server (`SUPABASE_SECRET_KEY`, migrations, RLS) là vấn đề riêng của hosted gameplay; Google OAuth không tự cấp quyền quản trị. |

Tài liệu chính thức: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

**Phạm vi triển khai:** code và unit/browser tests có thể chuẩn bị ngay; việc tạo OAuth Client, dán secrets, bật provider và kiểm chứng đăng nhập Google thật phải hoàn tất trong Google Cloud/Supabase do chủ dự án quản lý. Không merge `main` hay deploy production nếu chưa được phép.

## 7. Bằng chứng kiểm thử cục bộ (2026-11-05)

- `npm run auth:check`: PASS; Supabase URL và publishable key hiện hữu. Callback Google Cloud được in là `https://tyvczicinpjixmxgjhjn.supabase.co/auth/v1/callback`. Script không hiển thị khóa.
- `npm run check`: PASS trên Windows sau khi chạy native với quyền ghi thư mục build; 9/9 snapshot migration, lint, strict TypeScript, **728/728 Vitest**, Next.js Webpack **23/23 trang**.
- `ROOKLINE_E2E_PRODUCTION=1 npx playwright test e2e/google-oauth.spec.ts`: **3/3 PASS** bằng Chromium với Supabase authorize được giả lập; gồm login, register, hủy Google.
- Chưa xác minh bằng Google thật: Google OAuth Client, Google provider và Supabase Redirect URLs vẫn cần người quản trị cấu hình trên hai dashboard. Kết quả Chromium giả lập chỉ chứng minh UI và đường dẫn callback.

## 8. Kiểm tra dashboard ngày 05/11/2026 (sau bước 7)

- **Đã đối chiếu trên Google Cloud:** project `chess-513804`, OAuth Client dạng **Web application**; hai Authorized JavaScript origins và Google redirect URI đã trùng với giá trị trong mục 5. Client ID đã được cấp.
- **Đã đối chiếu trên Supabase:** project `tyvczicinpjixmxgjhjn`; Site URL là `https://chessonline-hnquan.vercel.app`; cả hai Redirect URLs tại mục 3 đang tồn tại.
- **Chưa hoàn tất trên Supabase:** `Authentication → Sign In / Providers → Google` vẫn **DISABLED**. Trường **Client IDs** trước khi cập nhật hiển thị một tên không phải Google OAuth Client ID. Đã nhập Client ID đúng vào biểu mẫu nhưng việc **Save** bị chặn trước khi thực thi vì chính sách phê duyệt thay đổi cấu hình xác thực; giá trị trong biểu mẫu **chưa được lưu**. Không kết luận Client Secret đang lưu (trường này hiển thị ký tự che).
- **Google Auth Platform → Audience:** `External / Testing`, không có Test users tại lần kiểm tra. Nên thêm tài khoản Google dùng thử để có kết quả có thể lặp lại. Theo tài liệu Google hiện hành, khi chỉ yêu cầu `openid`, `email`, `profile` thì tài khoản có thể dùng dù chưa nằm trong danh sách test, nhưng vẫn có thể thấy thông báo ứng dụng đang Testing; không coi 0 test users là lỗi chắc chắn.
- **Bảo mật:** Client Secret đã từng được gửi trong hội thoại, vì vậy chủ dự án cần **Reset secret** tại Google Cloud → OAuth Client, rồi **tự nhập** secret mới tại Supabase Provider, bật `Enable Sign in with Google`, giữ `Skip nonce checks` và `Allow users without an email` tắt, sau đó **Save**. Không gửi secret mới vào hội thoại hoặc Git.
- **Kiểm thử cuối còn thiếu:** thử đăng nhập Google thật trên `https://chessonline-hnquan.vercel.app/login`, xác nhận session và hồ sơ được tạo, đăng xuất rồi đăng nhập lại. Cho đến khi có kết quả này, trạng thái hosted Google OAuth là **BLOCKED_EXTERNAL**, cho dù các bài unit và browser giả lập đã chạy thành công.
