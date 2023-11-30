FROM hugomods/hugo:go-git-0.120.4 AS builder

WORKDIR /app

ADD ../ hugo

RUN cd hugo; \
    hugo -v --gc --minify

RUN git clone https://github.com/yangchuansheng/envoy-handbook envoy-handbook; \
    cd envoy-handbook; \
    hugo -v --gc --minify

FROM fholzer/nginx-brotli:latest

LABEL org.opencontainers.image.source https://github.com/yangchuansheng/blog

COPY --from=builder /app/hugo/public /usr/share/nginx/html
COPY --from=builder /app/envoy-handbook/public /usr/share/nginx/html/envoy-handbook