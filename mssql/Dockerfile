FROM mcr.microsoft.com/mysql/server:2022-latest
ENV ACCEPT_EULA=Y
ENV MSSQL_SA_PASSWORD=yourStrongP@ssword!
ENV MSSQL_PID=Express
COPY database_mssql.sql /docker-entrypoint-initdb.d/database_mssql.sql