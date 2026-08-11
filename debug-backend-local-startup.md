# Debug Session: backend-local-startup
- **Status**: [OPEN]
- **Issue**: Backend khong start duoc o local khi chay `./mvnw spring-boot:run`
- **Debug Server**: N/A
- **Log File**: N/A

## Reproduction Steps
1. Chay `./mvnw spring-boot:run` trong thu muc `backend`
2. Quan sat Spring Boot fail trong giai doan tao `entityManagerFactory`

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | MySQL local khong chay o `localhost:3306` | High | Low | Confirmed by stack trace `Connection refused` va khong co process listen port 3306 |
| B | `SPRING_DATASOURCE_URL` dang bi set sai host/port | Medium | Low | Chua thay trong log hien tai, can kiem tra env neu MySQL dang chay o cong khac |
| C | Sai username/password MySQL | Low | Low | Bi reject boi log hien tai vi loi la `Connection refused`, chua toi buoc auth |
| D | Hibernate/JPA fail do entity moi | Low | Low | Bi reject boi stack trace goc la JDBC connection failure truoc khi schema migrate |

## Log Evidence
- Spring Boot fail khi tao `entityManagerFactory`
- Root cause hien tai: `java.net.ConnectException: Connection refused`
- Datasource mac dinh dang tro toi `jdbc:mysql://localhost:3306/travel_luxury`

## Verification Conclusion
- Nguyen nhan hien tai nghieng manh ve viec MySQL local chua chay hoac backend dang tro sai cong/host.
