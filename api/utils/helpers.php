<?php
function generateVerificationToken() {
    return bin2hex(random_bytes(32));
}
?>