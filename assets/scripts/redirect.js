// Device detection and redirect
(function() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                     || window.innerWidth <= 768;
    
    const currentPath = window.location.pathname;
    const isInMobileDir = currentPath.includes('/mobile/');
    
    // Redirect mobile users to mobile version
    if (isMobile && !isInMobileDir) {
        window.location.href = './mobile/index.html';
    }
    // Redirect desktop users from mobile version to main version
    else if (!isMobile && isInMobileDir) {
        window.location.href = '../index.html';
    }
})();
