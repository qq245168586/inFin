from pathlib import Path


TARGET = Path("/etc/nginx/sites-enabled/infini-platform")


def patch_server_block(text: str, marker: str) -> str:
    start = text.find(marker)
    if start < 0:
        return text

    block_end = text.find("server {", start + len(marker))
    if block_end < 0:
        block_end = len(text)

    block = text[start:block_end]
    block = block.replace("listen 443 ssl http2;", "listen 443 ssl;")
    block = block.replace("listen [::]:443 ssl http2;", "listen [::]:443 ssl;")
    if "ssl_protocols TLSv1.2;" not in block:
        block = block.replace(
            "  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n",
            "  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n"
            "  ssl_protocols TLSv1.2;\n"
            "  ssl_ecdh_curve prime256v1;\n",
            1,
        )
    else:
        block = block.replace("ssl_protocols TLSv1.2;", "ssl_protocols TLSv1.2;")
        block = block.replace(
            "ssl_ecdh_curve prime256v1:secp384r1:X25519;", "ssl_ecdh_curve prime256v1;"
        )
        block = block.replace("ssl_ecdh_curve X25519:prime256v1;", "ssl_ecdh_curve prime256v1;")
    return text[:start] + block + text[block_end:]


text = TARGET.read_text()
text = patch_server_block(text, "server {\n  listen 443 ssl")
text = text.replace("ssl_ecdh_curve prime256v1:secp384r1:X25519;", "ssl_ecdh_curve prime256v1;")
TARGET.write_text(text)
