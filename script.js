// ============= متغيرات عامة =============
let currentUser = null;
let books = [];
let currentPage = 'home';
let currentBookId = null;
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
let currentCategory = 'all';
let darkMode = localStorage.getItem('darkMode') === 'true';
let db;

// ============= تهيئة التطبيق =============
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    initDB().then(() => {
        loadBooks();
        setupEventListeners();
        checkLoggedInStatus();
        initTheme();
        
        // محاكاة شاشة التحميل
        setTimeout(() => {
            document.getElementById('loadingScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
            }, 300);
        }, 1500);
    }).catch(error => {
        console.error('Error initializing app:', error);
        showToast('خطأ', 'حدث خطأ أثناء تهيئة التطبيق', 'error');
    });
}

// تهيئة قاعدة البيانات
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DigitalLibraryDB', 1);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // إنشاء مخزن للكتب
            const booksStore = db.createObjectStore('books', { keyPath: 'id' });
            booksStore.createIndex('category', 'category', { unique: false });
            
            // إنشاء مخزن للمستخدمين
            const usersStore = db.createObjectStore('users', { keyPath: 'id' });
            usersStore.createIndex('email', 'email', { unique: true });
            
            // إنشاء مخزن للجلسات
            db.createObjectStore('sessions', { keyPath: 'id' });
        };
    });
}

// تهيئة السمة
function initTheme() {
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// ============= إعداد المستمعين للأحداث =============
function setupEventListeners() {
    // مستمعو الصفحات
    document.querySelectorAll('[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });

    // زر القائمة للجوال
    document.getElementById('mobileMenuBtn').addEventListener('click', toggleMobileMenu);

    // مستمعو التبديل بين تسجيل الدخول وإنشاء حساب
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // نماذج تسجيل الدخول وإنشاء الحساب
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // مستمعو الإعدادات
    document.getElementById('profileSettingsForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('addBookForm').addEventListener('submit', handleAddBook);
    document.getElementById('saveAppSettings').addEventListener('click', handleAppSettings);
    
    // مستمعو تبديل السمة الداكنة
    document.getElementById('themeToggle').addEventListener('click', toggleDarkMode);
    document.getElementById('darkModeToggle').addEventListener('change', (e) => {
        darkMode = e.target.checked;
        updateTheme();
    });

    // مستمعو إعدادات السمة اللونية
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => changeTheme(option.dataset.theme));
    });

    // مستمعو الفلاتر والبحث
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => filterByCategory(btn.dataset.category));
    });
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // مستمعو قارئ الكتب
    document.getElementById('closeReaderBtn').addEventListener('click', () => {
        navigateTo(currentPage === 'reader' ? 'home' : currentPage);
    });
    document.getElementById('sidebarToggle').addEventListener('click', toggleReaderSidebar);
    document.getElementById('decreaseFontBtn').addEventListener('click', () => changeReaderFontSize(-1));
    document.getElementById('increaseFontBtn').addEventListener('click', () => changeReaderFontSize(1));
    document.getElementById('nightModeBtn').addEventListener('click', toggleReaderNightMode);
    document.getElementById('prevPageBtn').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPageBtn').addEventListener('click', () => changePage(1));
    document.getElementById('shareBtn').addEventListener('click', shareBook);
    document.getElementById('favBtn').addEventListener('click', toggleFavoriteBook);
    document.getElementById('searchTextBtn').addEventListener('click', searchInBook);

    // مستمعو الملف الشخصي
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab));
    });

    // مستمع زر تسجيل الخروج
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // معاينة الصور
    document.getElementById('profileImage').addEventListener('change', handleImagePreview);
    document.getElementById('settingsProfileImage').addEventListener('change', handleImagePreview);
    document.getElementById('bookCover').addEventListener('change', handleImagePreview);
    document.getElementById('bookFile').addEventListener('change', handleFileSelect);

    // إعداد تجربة المستخدم للقارئ
    setupReaderUX();
}

// ============= التنقل بين الصفحات =============
function navigateTo(page) {
    if (page === 'profile' || page === 'favorites' || page === 'settings') {
        if (!currentUser) {
            showToast('تنبيه', 'يجب تسجيل الدخول أولاً', 'warning');
            navigateTo('auth');
            return;
        }
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById(`${page}Page`).classList.add('active-page');
    
    // تحديث محتوى الصفحة المتنقل إليها
    if (page === 'home') {
        renderBooks();
    } else if (page === 'profile') {
        updateProfilePage();
    } else if (page === 'favorites') {
        renderFavorites();
    } else if (page === 'settings') {
        updateSettingsPage();
    }
    
    currentPage = page;
    
    // إغلاق قائمة الجوال إن كانت مفتوحة
    document.getElementById('mobileMenu').classList.remove('active');
}

// ============= إدارة الحسابات =============
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // التحقق من صحة البيانات
    if (!email || !password) {
        showToast('خطأ', 'يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    const transaction = db.transaction(['users'], 'readonly');
    const store = transaction.objectStore('users');
    const index = store.index('email');
    const request = index.get(email);
    
    request.onsuccess = (event) => {
        const user = event.target.result;
        
        if (user && user.password === password) {
            currentUser = user;
            
            // حفظ الجلسة
            const sessionTransaction = db.transaction(['sessions'], 'readwrite');
            const sessionStore = sessionTransaction.objectStore('sessions');
            sessionStore.put({ id: 'current', user: user });
            
            updateUIAfterLogin();
            navigateTo('home');
            showToast('مرحباً', `مرحباً بعودتك ${user.name}!`, 'success');
        } else {
            showToast('خطأ', 'البريد الإلكتروني أو كلمة المرور غير صحيحة', 'error');
        }
    };
    
    request.onerror = (event) => {
        console.error('Error during login:', event.target.error);
        showToast('خطأ', 'حدث خطأ أثناء تسجيل الدخول', 'error');
    };
}

function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const age = document.getElementById('registerAge').value;
    const bio = document.getElementById('registerBio').value;
    
    // التحقق من صحة البيانات
    if (!name || !email || !password) {
        showToast('خطأ', 'يرجى ملء الحقول الإلزامية', 'error');
        return;
    }
    
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const index = store.index('email');
    const checkRequest = index.get(email);
    
    checkRequest.onsuccess = (event) => {
        if (event.target.result) {
            showToast('خطأ', 'البريد الإلكتروني مستخدم بالفعل', 'error');
            return;
        }
        
        // إنشاء المستخدم الجديد
        const newUser = {
            id: Date.now(),
            name,
            email,
            password,
            age,
            bio,
            profileImage: document.getElementById('profilePreview').src,
            favorites: [],
            reading: [],
            finished: [],
            myBooks: []
        };
        
        // حفظ المستخدم
        const addRequest = store.add(newUser);
        
        addRequest.onsuccess = () => {
            // تسجيل الدخول تلقائياً
            currentUser = newUser;
            
            // حفظ الجلسة
            const sessionTransaction = db.transaction(['sessions'], 'readwrite');
            const sessionStore = sessionTransaction.objectStore('sessions');
            sessionStore.put({ id: 'current', user: newUser });
            
            updateUIAfterLogin();
            navigateTo('home');
            showToast('مرحباً', `مرحباً بك ${name}!`, 'success');
        };
        
        addRequest.onerror = (event) => {
            console.error('Error registering user:', event.target.error);
            showToast('خطأ', 'حدث خطأ أثناء إنشاء الحساب', 'error');
        };
    };
    
    checkRequest.onerror = (event) => {
        console.error('Error checking email:', event.target.error);
        showToast('خطأ', 'حدث خطأ أثناء التحقق من البريد الإلكتروني', 'error');
    };
}

function handleLogout() {
    const transaction = db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    const request = store.delete('current');
    
    request.onsuccess = () => {
        currentUser = null;
        updateUIAfterLogout();
        navigateTo('home');
        showToast('تم تسجيل الخروج', 'نراك قريباً!', 'success');
    };
    
    request.onerror = (event) => {
        console.error('Error during logout:', event.target.error);
        showToast('خطأ', 'حدث خطأ أثناء تسجيل الخروج', 'error');
    };
}

function checkLoggedInStatus() {
    const transaction = db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const request = store.get('current');
    
    request.onsuccess = (event) => {
        const session = event.target.result;
        if (session && session.user) {
            currentUser = session.user;
            updateUIAfterLogin();
        } else {
            updateUIAfterLogout();
        }
    };
    
    request.onerror = (event) => {
        console.error('Error checking session:', event.target.error);
        updateUIAfterLogout();
    };
}

function updateUIAfterLogin() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('userMenu').style.display = 'block';
    document.getElementById('navProfileImage').src = currentUser.profileImage;
}

function updateUIAfterLogout() {
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('userMenu').style.display = 'none';
}

// ============= الكتب والمحتوى =============
function loadBooks() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['books'], 'readonly');
        const store = transaction.objectStore('books');
        const request = store.getAll();

        request.onsuccess = (event) => {
            const savedBooks = event.target.result;
            
            if (savedBooks && savedBooks.length > 0) {
                books = savedBooks;
                renderBooksBatch(0, 10); // عرض أول 10 كتب ثم البقية
            } else {
                // إضافة الكتب الافتراضية إذا لم توجد
                books = [
                    {
                        id: 1,
                        title: "ألف ليلة وليلة",
                        author: "مؤلف تراثي مجهول",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "مجموعة من القصص والحكايات الشعبية التي تعود أصولها إلى العصر الذهبي للحضارة الإسلامية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 2,
                        title: "الأمير",
                        author: "نيكولو مكيافيلي",
                        category: "philosophy",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب في فن الحكم والسياسة، يعتبر من أهم الكتب السياسية في التاريخ.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 3,
                        title: "فن الحرب",
                        author: "سون تزو",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب صيني قديم يعد من أقدم وأهم الكتب العسكرية والاستراتيجية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 4,
                        title: "البخلاء",
                        author: "الجاحظ",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب أدبي ساخر يصور فيه الجاحظ نماذج من البخلاء بأسلوب أدبي مميز.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 5,
                        title: "أساسيات البرمجة بلغة Python",
                        author: "د. أحمد الشريف",
                        category: "programming",
                        cover: "/api/placeholder/200/300",
                        description: "مقدمة شاملة للمبتدئين في عالم البرمجة باستخدام لغة Python.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 6,
                        title: "تاريخ العلوم عند العرب",
                        author: "د. قدري حافظ طوقان",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب يتناول إسهامات العلماء العرب والمسلمين في مختلف مجالات العلوم.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 7,
                        title: "فن اللامبالاة",
                        author: "مارك مانسون",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "منهج جديد في التفكير الإيجابي يساعدك على التركيز على ما هو مهم فعلاً في حياتك.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 8,
                        title: "وداعاً أيها الاكتئاب",
                        author: "د. إبراهيم الفقي",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب يساعدك على التخلص من الاكتئاب والحزن والوصول إلى السعادة والإيجابية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 9,
                        title: "كليلة ودمنة",
                        author: "ابن المقفع",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "مجموعة من القصص على ألسنة الحيوانات تحمل حكماً وعبراً.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 10,
                        title: "مقدمة ابن خلدون",
                        author: "ابن خلدون",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "من أهم الكتب في تاريخ الفكر الإنساني، يتناول التاريخ والعمران البشري.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 11,
                        title: "فيزياء الكم للمبتدئين",
                        author: "د. سامي عامر",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "شرح مبسط لنظرية الكم وتطبيقاتها في العلوم الحديثة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 12,
                        title: "خوارزميات البيانات المتقدمة",
                        author: "م. عماد الحسيني",
                        category: "programming",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب متقدم في هياكل البيانات والخوارزميات للمبرمجين.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 13,
                        title: "العادات السبع للناس الأكثر فعالية",
                        author: "ستيفن كوفي",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب يقدم سبع عادات أساسية للنجاح في الحياة المهنية والشخصية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 14,
                        title: "هجرة العقول العربية",
                        author: "د. نادر فرجاني",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "دراسة تحليلية لظاهرة هجرة العقول العربية وأثرها على التنمية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 15,
                        title: "عقل جديد كامل",
                        author: "دانييل بينك",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب يتحدث عن أهمية التفكير الإبداعي والعاطفي في عصر المعلومات.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 16,
                        title: "تاريخ الدولة العثمانية",
                        author: "د. علي محمد الصلابي",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب يتناول تاريخ الدولة العثمانية منذ نشأتها وحتى سقوطها.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 17,
                        title: "في ظلال القرآن",
                        author: "سيد قطب",
                        category: "philosophy",
                        cover: "/api/placeholder/200/300",
                        description: "تفسير أدبي للقرآن الكريم بأسلوب أدبي فريد.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 18,
                        title: "تصميم واجهات المستخدم الحديثة",
                        author: "م. سارة الجابري",
                        category: "programming",
                        cover: "/api/placeholder/200/300",
                        description: "دليل شامل لتصميم واجهات المستخدم بأحدث التقنيات والمعايير.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 19,
                        title: "أحببتك أكثر مما ينبغي",
                        author: "أثير عبد الله",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "رواية رومانسية عن قصة حب بين شخصيتين من خلفيات مختلفة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 20,
                        title: "علم النفس الإيجابي",
                        author: "د. مارتن سليجمان",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب يركز على نقاط القوة والإيجابية في الشخصية الإنسانية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    // الكتب الجديدة المضافة
                    {
                        id: 21,
                        title: "زوجة لاعب البوكر",
                        author: "ويليام آيريش",
                        category: "novels",
                        cover: "la_esposa_jugador_del_de_poquer.png",
                        description: "قصة قصيرة مثيرة عن زوجة لاعب بوكر محترف تواجه موقفًا صعبًا عندما تخسر عائلتها كل شيء في لعبة بوكر.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 22,
                        title: "العقد الاجتماعي",
                        author: "جان جاك روسو",
                        category: "philosophy",
                        cover: "/api/placeholder/200/300",
                        description: "أحد أهم الكتب في الفلسفة السياسية الذي يناقش فكرة العقد بين الحاكم والمحكومين.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 23,
                        title: "الذرة والكون",
                        author: "د. مصطفى محمود",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب علمي يشرح بنية الذرة وتكوين الكون بلغة مبسطة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 24,
                        title: "الطريق إلى الكفاح",
                        author: "مالكوم إكس",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "سيرة ذاتية لمالكوم إكس تروي رحلته من السجن إلى قيادة حركة الحقوق المدنية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 25,
                        title: "فن اللامبالاة 2",
                        author: "مارك مانسون",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "الجزء الثاني من الكتاب الأكثر مبيعًا الذي يعلمك كيف تعيش حياة لا تهتم فيها بما لا يستحق.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 26,
                        title: "تعلم JavaScript في 24 ساعة",
                        author: "سامي الجابري",
                        category: "programming",
                        cover: "/api/placeholder/200/300",
                        description: "دليل سريع لتعلم أساسيات لغة JavaScript للمبتدئين.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 27,
                        title: "مدائن في السماء",
                        author: "أحمد خالد توفيق",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "رواية خيال علمي من تأليف العراب أحمد خالد توفيق.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 28,
                        title: "الكون في قشرة جوز",
                        author: "ستيفن هوكينج",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "شرح مبسط لنظريات الفيزياء الحديثة من قبل أحد أعظم العقول العلمية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 29,
                        title: "تاريخ الأندلس",
                        author: "د. طارق سويدان",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب شامل عن تاريخ الأندلس من الفتح الإسلامي حتى سقوط غرناطة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 30,
                        title: "قوة التفكير الإيجابي",
                        author: "نورمان فنسنت بيل",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "كتاب كلاسيكي عن كيفية تحسين حياتك من خلال تغيير طريقة تفكيرك.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 31,
                        title: "أساسيات الذكاء الاصطناعي",
                        author: "د. محمد السيد",
                        category: "programming",
                        cover: "/api/placeholder/200/300",
                        description: "مقدمة شاملة لمفاهيم الذكاء الاصطناعي وتطبيقاته العملية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 32,
                        title: "1984",
                        author: "جورج أورويل",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "رواية ديستوبية كلاسيكية عن مجتمع خاضع لمراقبة دائمة من قبل الحكومة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 33,
                        title: "الكون الأنيق",
                        author: "بريان غرين",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "استكشاف لنظرية الأوتار الفائقة وإمكانية توحيد قوى الكون.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 34,
                        title: "سقوط الدولة العباسية",
                        author: "د. علي الصلابي",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "تحليل لأسباب سقوط الدولة العباسية ودروس مستفادة للعصر الحديث.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 35,
                        title: "العادات الذرية",
                        author: "جيمس كلير",
                        category: "selfDev",
                        cover: "/api/placeholder/200/300",
                        description: "كيفية بناء عادات جيدة وكسر العادات السيئة من خلال تغييرات صغيرة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 36,
                        title: "تعلم بايثون من الصفر",
                        author: "أحمد الشريف",
                        category: "programming",
                        cover: "/api/placeholder/200/300",
                        description: "دليل شامل لتعلم لغة بايثون من الأساسيات إلى المستوى المتوسط.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 37,
                        title: "المسالك والممالك",
                        author: "البكري",
                        category: "history",
                        cover: "/api/placeholder/200/300",
                        description: "أحد أهم الكتب الجغرافية في التراث الإسلامي يصف البلدان والطرق التجارية.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 38,
                        title: "الرجل الذي عرف كل شيء",
                        author: "أحمد خالد توفيق",
                        category: "novels",
                        cover: "/api/placeholder/200/300",
                        description: "رواية فلسفية تتناول أسئلة الوجود والمعرفة من خلال قصة مثيرة.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                        id: 39,
                        title: "الكون والثقوب السوداء",
                        author: "د. نيل ديجراس تايسون",
                        category: "science",
                        cover: "/api/placeholder/200/300",
                        description: "رحلة في أعماق الكون لاستكشاف أكثر الظواهر غرابة في الفضاء.",
                        addedBy: null,
                        isFavorite: false
                    },
                    {
                      id: 40,
                      title: "زوجة لاعب البوكر",
                      author: "ويليام آيريش",
                      category: "novels",
                      cover: "/assets/images/covers/la_esposa_jugador_del_de_poquer.png",
                      pdfFile: "/assets/pdfs/la_esposa_jugador_del_de_poquer.pdf",
                      description: "قصة قصيرة عن حياة المقامرين والمخاطر التي يواجهونها.",
                      addedBy: null,
                      isFavorite: false
                    }
                ];
                
                const addTransaction = db.transaction(['books'], 'readwrite');
                const addStore = addTransaction.objectStore('books');
                
                books.forEach(book => {
                    addStore.add(book);
                });
            }
            
            resolve();
        };

        request.onerror = (event) => {
            console.error('Error loading books:', event.target.error);
            reject(event.target.error);
        };
    });
}

function renderBooksBatch(start, batchSize) {
    const end = Math.min(start + batchSize, books.length);
    const batch = books.slice(start, end);
    
    renderBooks(batch);
    
    if (end < books.length) {
        setTimeout(() => {
            renderBooksBatch(end, batchSize);
        }, 300);
    }
}

function renderBooks(filteredBooks = null) {
    const booksContainer = document.getElementById('booksContainer');
    booksContainer.innerHTML = '';
    
    const booksToRender = filteredBooks || books;
    
    if (booksToRender.length === 0) {
        booksContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-book"></i>
                </div>
                <div class="empty-text">لم يتم العثور على كتب</div>
            </div>
        `;
        return;
    }
    
    booksToRender.forEach(book => {
        const isFavorite = currentUser && currentUser.favorites.includes(book.id);
        const card = document.createElement('div');
        card.className = 'book-card animate__animated animate__fadeIn';
        card.dataset.id = book.id;
        card.onclick = () => openBookReader(book.id);
        
        card.innerHTML = `
            <img src="${book.cover}" alt="${book.title}" class="book-cover">
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                <span class="book-category">${getCategoryName(book.category)}</span>
                <div class="book-actions">
                    <button class="book-btn favorite-btn" data-id="${book.id}" onclick="toggleFavorite(event, ${book.id})">
                        <i class="fa${isFavorite ? 's' : 'r'} fa-heart"></i>
                    </button>
                    <button class="book-btn" onclick="showBookDetails(event, ${book.id})">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        `;
        
        booksContainer.appendChild(card);
    });
}

function getCategoryName(categoryCode) {
    const categories = {
        'novels': 'روايات',
        'science': 'علوم',
        'history': 'تاريخ',
        'selfDev': 'تطوير ذاتي',
        'programming': 'برمجة',
        'philosophy': 'فلسفة'
    };
    
    return categories[categoryCode] || categoryCode;
}

function filterByCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.category-btn[data-category="${category}"]`).classList.add('active');
    
    currentCategory = category;
    
    if (category === 'all') {
        renderBooks();
    } else {
        const filteredBooks = books.filter(book => book.category === category);
        renderBooks(filteredBooks);
    }
}

function handleSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (query === '') {
        filterByCategory(currentCategory);
        return;
    }
    
    let filteredBooks = books;
    
    if (currentCategory !== 'all') {
        filteredBooks = filteredBooks.filter(book => book.category === currentCategory);
    }
    
    filteredBooks = filteredBooks.filter(book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query) ||
        book.description.toLowerCase().includes(query)
    );
    
    renderBooks(filteredBooks);
}

function toggleFavorite(event, bookId) {
    event.stopPropagation();
    
    if (!currentUser) {
        showToast('تنبيه', 'يجب تسجيل الدخول أولاً', 'warning');
        navigateTo('auth');
        return;
    }
    
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const request = store.get(currentUser.id);
    
    request.onsuccess = (event) => {
        const user = event.target.result;
        if (!user) return;
        
        const favoriteIndex = user.favorites.indexOf(bookId);
        
        if (favoriteIndex === -1) {
            // إضافة إلى المفضلة
            user.favorites.push(bookId);
            event.currentTarget.innerHTML = '<i class="fas fa-heart"></i>';
            showToast('تمت الإضافة', 'تمت إضافة الكتاب إلى المفضلة', 'success');
        } else {
            // إزالة من المفضلة
            user.favorites.splice(favoriteIndex, 1);
            event.currentTarget.innerHTML = '<i class="far fa-heart"></i>';
            showToast('تمت الإزالة', 'تمت إزالة الكتاب من المفضلة', 'success');
        }
        
        // تحديث بيانات المستخدم
        const updateRequest = store.put(user);
        
        updateRequest.onsuccess = () => {
            currentUser = user;
            
            // تحديث صفحة المفضلة إذا كانت مفتوحة
            if (currentPage === 'favorites') {
                renderFavorites();
            }
        };
        
        updateRequest.onerror = (event) => {
            console.error('Error updating favorites:', event.target.error);
        };
    };
    
    request.onerror = (event) => {
        console.error('Error getting user:', event.target.error);
    };
}

function showBookDetails(event, bookId) {
    event.stopPropagation();
    
    const book = books.find(b => b.id === bookId);
    
    if (!book) return;
    
    // إنشاء نافذة منبثقة لعرض تفاصيل الكتاب
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content animate__animated animate__fadeInDown">
            <div class="modal-header">
                <h2>${book.title}</h2>
                <button class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="book-details">
                    <img src="${book.cover}" alt="${book.title}" class="book-details-cover">
                    <div class="book-details-info">
                        <p><strong>المؤلف:</strong> ${book.author}</p>
                        <p><strong>التصنيف:</strong> ${getCategoryName(book.category)}</p>
                        <p><strong>الوصف:</strong> ${book.description}</p>
                        ${book.addedBy ? `<p><strong>تمت الإضافة بواسطة:</strong> ${getUserName(book.addedBy)}</p>` : ''}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="openBookReader(${book.id})">قراءة الكتاب</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // إغلاق النافذة المنبثقة
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.classList.add('animate__animated', 'animate__fadeOut');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    });
    
    // إغلاق النافذة المنبثقة عند النقر خارجها
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('animate__animated', 'animate__fadeOut');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        }
    });
}

function getUserName(userId) {
    return new Promise((resolve) => {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(userId);
        
        request.onsuccess = (event) => {
            const user = event.target.result;
            resolve(user ? user.name : 'مستخدم غير معروف');
        };
        
        request.onerror = () => {
            resolve('مستخدم غير معروف');
        };
    });
}

function openBookReader(bookId) {
    currentBookId = bookId;
    const book = books.find(b => b.id === bookId);
    
    if (!book) return;
    
    // تحديث معلومات الكتاب في قارئ الكتب
    document.getElementById('readerBookCover').src = book.cover;
    document.getElementById('readerBookTitle').textContent = book.title;
    document.getElementById('readerBookAuthor').textContent = book.author;
    
    // تحميل ملف PDF وعرضه
    loadPdf(book);
    
    // إضافة الكتاب إلى قائمة الكتب قيد القراءة إذا كان المستخدم مسجل دخول
    if (currentUser && !currentUser.reading.includes(bookId)) {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const request = store.get(currentUser.id);
        
        request.onsuccess = (event) => {
            const user = event.target.result;
            if (!user) return;
            
            user.reading.push(bookId);
            const updateRequest = store.put(user);
            
            updateRequest.onsuccess = () => {
                currentUser = user;
            };
        };
    }
    
    // التنقل إلى صفحة القارئ
    navigateTo('reader');
}

// ============= وظائف قارئ الكتب =============
function loadPdf(book) {
    const pdfUrl = book.pdfFile || "/assets/pdfs/default.pdf"; // استخدام ملف PDF مخصص أو الافتراضي
    
    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf) {
        pdfDoc = pdf;
        document.getElementById('totalPages').textContent = pdf.numPages;
        // عرض صفحة الغلاف (الصفحة 1)
        pageNum = 1;
        renderPage(pageNum);
        
        // إنشاء جدول المحتويات
        createTOC(pdf);
        
        // تحديث زر المفضلة
        updateFavButton(book.id);
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        document.getElementById('pdfViewer').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>فشل في تحميل الكتاب. يرجى المحاولة مرة أخرى لاحقاً.</p>
            </div>
        `;
    });
}

function renderPage(num) {
    pageRendering = true;
    document.getElementById('currentPage').textContent = num;
    
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = '<div class="pdf-text-container"></div>';
    const textContainer = viewer.querySelector('.pdf-text-container');
    
    pdfDoc.getPage(num).then(function(page) {
        return page.getTextContent();
    }).then(function(textContent) {
        const textLayer = document.createElement('div');
        textLayer.className = 'text-layer';
        
        // إنشاء عناصر النص
        textContent.items.forEach(function(textItem) {
            const textElement = document.createElement('div');
            textElement.className = 'text-element';
            textElement.style.left = textItem.transform[4] + 'px';
            textElement.style.top = textItem.transform[5] + 'px';
            textElement.style.fontSize = Math.abs(textItem.height) + 'px';
            textElement.textContent = textItem.str;
            textLayer.appendChild(textElement);
        });
        
        textContainer.appendChild(textLayer);
        pageRendering = false;
        
        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(error => {
        console.error('Error rendering page:', error);
        viewer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>فشل في عرض الصفحة. يرجى المحاولة مرة أخرى.</p>
            </div>
        `;
        pageRendering = false;
    });
}

function createTOC(pdf) {
    const tocList = document.getElementById('tocList');
    tocList.innerHTML = '';
    
    // في تطبيق حقيقي، يمكنك استخراج جدول المحتويات من ملف PDF
    // لهذا النموذج، سننشئ جدول محتويات وهمي
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const tocItem = document.createElement('li');
        tocItem.className = 'toc-item';
        
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = `الفصل ${i}`;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            queueRenderPage(i);
        });
        
        tocItem.appendChild(link);
        tocList.appendChild(tocItem);
    }
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function changePage(offset) {
    const newPageNum = pageNum + offset;
    
    if (newPageNum >= 1 && newPageNum <= pdfDoc.numPages) {
        pageNum = newPageNum;
        queueRenderPage(pageNum);
    }
}

function changeReaderFontSize(change) {
    scale += change * 0.1;
    
    // التأكد من أن النطاق ضمن الحدود المعقولة
    if (scale < 0.5) scale = 0.5;
    if (scale > 2.5) scale = 2.5;
    
    renderPage(pageNum);
    showToast('تغيير الحجم', 'تم تغيير حجم العرض', 'info');
}

function toggleReaderSidebar() {
    const readerContainer = document.querySelector('.reader-container');
    readerContainer.classList.toggle('sidebar-collapsed');
}

function toggleReaderNightMode() {
    const readerPage = document.getElementById('readerPage');
    readerPage.classList.toggle('reader-night-mode');
    
    const nightModeBtn = document.getElementById('nightModeBtn');
    
    if (readerPage.classList.contains('reader-night-mode')) {
        nightModeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        nightModeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function updateFavButton(bookId) {
    const favBtn = document.getElementById('favBtn');
    const isFavorite = currentUser && currentUser.favorites.includes(bookId);
    
    if (isFavorite) {
        favBtn.innerHTML = '<i class="fas fa-heart"></i>';
    } else {
        favBtn.innerHTML = '<i class="far fa-heart"></i>';
    }
}

function toggleFavoriteBook() {
    if (!currentUser) {
        showToast('تنبيه', 'يجب تسجيل الدخول أولاً', 'warning');
        navigateTo('auth');
        return;
    }
    
    const bookId = currentBookId;
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const request = store.get(currentUser.id);
    
    request.onsuccess = (event) => {
        const user = event.target.result;
        if (!user) return;
        
        const favoriteIndex = user.favorites.indexOf(bookId);
        
        if (favoriteIndex === -1) {
            // إضافة إلى المفضلة
            user.favorites.push(bookId);
            document.getElementById('favBtn').innerHTML = '<i class="fas fa-heart"></i>';
            showToast('تمت الإضافة', 'تمت إضافة الكتاب إلى المفضلة', 'success');
        } else {
            // إزالة من المفضلة
            user.favorites.splice(favoriteIndex, 1);
            document.getElementById('favBtn').innerHTML = '<i class="far fa-heart"></i>';
            showToast('تمت الإزالة', 'تمت إزالة الكتاب من المفضلة', 'success');
        }
        
        // تحديث بيانات المستخدم
        const updateRequest = store.put(user);
        
        updateRequest.onsuccess = () => {
            currentUser = user;
        };
    };
}

function shareBook() {
    if (!navigator.share) {
        showToast('غير مدعوم', 'مشاركة الروابط غير مدعومة في متصفحك', 'warning');
        return;
    }
    
    const book = books.find(b => b.id === currentBookId);
    
    if (!book) return;
    
    navigator.share({
        title: book.title,
        text: `أقرأ الآن: ${book.title} بواسطة ${book.author}`,
        url: window.location.href
    })
    .then(() => showToast('تمت المشاركة', 'تم مشاركة الكتاب بنجاح', 'success'))
    .catch(error => {
        console.error('Error sharing:', error);
        showToast('خطأ', 'فشلت عملية المشاركة', 'error');
    });
}

function searchInBook() {
    // إنشاء نافذة بحث منبثقة
    const searchDialog = document.createElement('div');
    searchDialog.className = 'search-dialog animate__animated animate__fadeIn';
    searchDialog.innerHTML = `
        <div class="search-dialog-content">
            <h3>البحث في الكتاب</h3>
            <div class="search-input-container">
                <input type="text" id="bookSearchInput" placeholder="أدخل نص البحث..." class="search-input">
                <button id="bookSearchBtn" class="search-dialog-btn">بحث</button>
            </div>
            <div id="searchResults" class="search-results"></div>
            <button class="close-dialog-btn">إغلاق</button>
        </div>
    `;
    
    document.body.appendChild(searchDialog);
    
    // التركيز على حقل البحث
    setTimeout(() => {
        document.getElementById('bookSearchInput').focus();
    }, 100);
    
    // إضافة مستمعي الأحداث
    document.getElementById('bookSearchBtn').addEventListener('click', performBookSearch);
    document.getElementById('bookSearchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performBookSearch();
    });
    
    document.querySelector('.close-dialog-btn').addEventListener('click', () => {
        searchDialog.classList.add('animate__fadeOut');
        setTimeout(() => {
            document.body.removeChild(searchDialog);
        }, 300);
    });
}

function performBookSearch() {
    const query = document.getElementById('bookSearchInput').value.trim();
    
    if (!query) {
        showToast('تنبيه', 'الرجاء إدخال نص للبحث', 'warning');
        return;
    }
    
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '<div class="searching">جاري البحث...</div>';
    
    // في تطبيق حقيقي، هنا يمكنك البحث في محتوى PDF
    // لأغراض العرض التوضيحي، سننشئ نتائج وهمية بعد تأخير قصير
    
    setTimeout(() => {
        // عرض نتائج وهمية للعرض التوضيحي
        const results = [
            { page: 3, text: `... ${query} هو مفهوم أساسي في هذا الفصل ...` },
            { page: 7, text: `... يمكننا فهم ${query} من خلال ...` },
            { page: 12, text: `... وهكذا نستنتج أن ${query} يعتبر ...` }
        ];
        
        if (results.length > 0) {
            searchResults.innerHTML = '';
            results.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.innerHTML = `
                    <p class="result-text">${result.text}</p>
                    <button class="go-to-page-btn" data-page="${result.page}">انتقال للصفحة ${result.page}</button>
                `;
                searchResults.appendChild(resultItem);
            });
            
            // إضافة مستمعي الأحداث للأزرار
            document.querySelectorAll('.go-to-page-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pageToGo = parseInt(btn.dataset.page);
                    queueRenderPage(pageToGo);
                    
                    // إغلاق نافذة البحث
                    const searchDialog = document.querySelector('.search-dialog');
                    searchDialog.classList.add('animate__fadeOut');
                    setTimeout(() => {
                        document.body.removeChild(searchDialog);
                    }, 300);
                });
            });
        } else {
            searchResults.innerHTML = '<div class="no-results">لم يتم العثور على نتائج</div>';
        }
    }, 1000);
}

// ============= وظائف الملف الشخصي =============
function updateProfilePage() {
    if (!currentUser) return;
    
    // تحديث معلومات الملف الشخصي
    document.getElementById('profilePageImage').src = currentUser.profileImage;
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileInfo').textContent = `العمر: ${currentUser.age || 'غير محدد'} | البريد: ${currentUser.email}`;
    document.getElementById('profileBio').textContent = currentUser.bio || 'لا توجد نبذة تعريفية';
    
    // تحديث الإحصائيات
    document.getElementById('booksCount').textContent = currentUser.myBooks.length;
    document.getElementById('favoritesCount').textContent = currentUser.favorites.length;
    document.getElementById('readCount').textContent = currentUser.finished.length;
    
    // تحديث قوائم الكتب
    renderMyBooks();
    renderReadingBooks();
    renderFinishedBooks();
}

function renderMyBooks() {
    const container = document.getElementById('myBooksContainer');
    container.innerHTML = '';
    
    if (!currentUser || currentUser.myBooks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-book"></i>
                </div>
                <div class="empty-text">لا يوجد كتب قمت بإضافتها</div>
                <button class="btn" data-page="settings">إضافة كتاب</button>
            </div>
        `;
        return;
    }
    
    currentUser.myBooks.forEach(bookId => {
        const book = books.find(b => b.id === bookId);
        if (book) {
            const card = createBookCard(book);
            container.appendChild(card);
        }
    });
}

function renderReadingBooks() {
    const container = document.getElementById('readingBooksContainer');
    container.innerHTML = '';
    
    if (!currentUser || currentUser.reading.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-book-reader"></i>
                </div>
                <div class="empty-text">لا يوجد كتب قيد القراءة</div>
                <button class="btn" data-page="home">استعرض الكتب</button>
            </div>
        `;
        return;
    }
    
    currentUser.reading.forEach(bookId => {
        const book = books.find(b => b.id === bookId);
        if (book) {
            const card = createBookCard(book, true);
            container.appendChild(card);
        }
    });
}

function renderFinishedBooks() {
    const container = document.getElementById('finishedBooksContainer');
    container.innerHTML = '';
    
    if (!currentUser || currentUser.finished.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="empty-text">لم تنتهِ من قراءة أي كتاب بعد</div>
            </div>
        `;
        return;
    }
    
    currentUser.finished.forEach(bookId => {
        const book = books.find(b => b.id === bookId);
        if (book) {
            const card = createBookCard(book);
            container.appendChild(card);
        }
    });
}

function createBookCard(book, showMarkAsFinished = false) {
    const card = document.createElement('div');
    card.className = 'book-card animate__animated animate__fadeIn';
    card.dataset.id = book.id;
    
    const isFavorite = currentUser && currentUser.favorites.includes(book.id);
    
    let additionalButtons = '';
    if (showMarkAsFinished) {
        additionalButtons = `
            <button class="book-btn" onclick="markAsFinished(event, ${book.id})">
                <i class="fas fa-check"></i>
            </button>
        `;
    }
    
    card.innerHTML = `
        <img src="${book.cover}" alt="${book.title}" class="book-cover">
        <div class="book-info">
            <h3 class="book-title">${book.title}</h3>
            <p class="book-author">${book.author}</p>
            <span class="book-category">${getCategoryName(book.category)}</span>
            <div class="book-actions">
                <button class="book-btn favorite-btn" onclick="toggleFavorite(event, ${book.id})">
                    <i class="fa${isFavorite ? 's' : 'r'} fa-heart"></i>
                </button>
                <button class="book-btn" onclick="showBookDetails(event, ${book.id})">
                    <i class="fas fa-info-circle"></i>
                </button>
                ${additionalButtons}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openBookReader(book.id));
    
    return card;
}

function switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.profile-tab[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}Tab`).classList.add('active');
}

function markAsFinished(event, bookId) {
    event.stopPropagation();
    
    if (!currentUser) return;
    
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const request = store.get(currentUser.id);
    
    request.onsuccess = (event) => {
        const user = event.target.result;
        if (!user) return;
        
        // إزالة من قيد القراءة
        const readingIndex = user.reading.indexOf(bookId);
        if (readingIndex !== -1) {
            user.reading.splice(readingIndex, 1);
        }
        
        // إضافة إلى المنتهية إن لم تكن موجودة
        if (!user.finished.includes(bookId)) {
            user.finished.push(bookId);
        }
        
        // تحديث بيانات المستخدم
        const updateRequest = store.put(user);
        
        updateRequest.onsuccess = () => {
            currentUser = user;
            renderReadingBooks();
            renderFinishedBooks();
            showToast('تم الانتهاء', 'تم نقل الكتاب إلى قائمة الكتب المنتهية', 'success');
        };
    };
}

// ============= وظائف المفضلة =============
function renderFavorites() {
    const container = document.getElementById('favoritesContainer');
    const emptyState = document.getElementById('emptyFavorites');
    
    container.innerHTML = '';
    
    if (!currentUser || currentUser.favorites.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    currentUser.favorites.forEach(bookId => {
        const book = books.find(b => b.id === bookId);
        if (book) {
            const card = createBookCard(book);
            container.appendChild(card);
        }
    });
}

// ============= وظائف الإعدادات =============
function updateSettingsPage() {
    if (!currentUser) return;
    
    // تعبئة نموذج إعدادات الملف الشخصي
    document.getElementById('settingsProfilePreview').src = currentUser.profileImage;
    document.getElementById('settingsName').value = currentUser.name;
    document.getElementById('settingsEmail').value = currentUser.email;
    document.getElementById('settingsAge').value = currentUser.age || '';
    document.getElementById('settingsBio').value = currentUser.bio || '';
    
    // تعبئة إعدادات التطبيق
    document.getElementById('darkModeToggle').checked = darkMode;
}

function handleProfileUpdate(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const request = store.get(currentUser.id);
    
    request.onsuccess = (event) => {
        const user = event.target.result;
        if (!user) return;
        
        // تحديث بيانات المستخدم
        user.name = document.getElementById('settingsName').value;
        user.age = document.getElementById('settingsAge').value;
        user.bio = document.getElementById('settingsBio').value;
        user.profileImage = document.getElementById('settingsProfilePreview').src;
        
        // حفظ البيانات
        const updateRequest = store.put(user);
        
        updateRequest.onsuccess = () => {
            currentUser = user;
            updateUIAfterLogin();
            updateProfilePage();
            showToast('تم التحديث', 'تم تحديث بيانات الملف الشخصي بنجاح', 'success');
        };
    };
}

function handleAddBook(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const title = document.getElementById('bookTitle').value;
    const author = document.getElementById('bookAuthor').value;
    const category = document.getElementById('bookCategory').value;
    const description = document.getElementById('bookDescription').value;
    const cover = document.getElementById('bookCoverPreview').src;
    
    // التحقق من صحة البيانات
    if (!title || !author || !category) {
        showToast('خطأ', 'يرجى ملء الحقول الإلزامية', 'error');
        return;
    }
    
    // إنشاء كتاب جديد
    const newBook = {
        id: Date.now(),
        title,
        author,
        category,
        description,
        cover,
        addedBy: currentUser.id,
        isFavorite: false
    };
    
    // إضافة الكتاب إلى قاعدة البيانات
    const booksTransaction = db.transaction(['books'], 'readwrite');
    const booksStore = booksTransaction.objectStore('books');
    const addBookRequest = booksStore.add(newBook);
    
    addBookRequest.onsuccess = () => {
        // إضافة الكتاب إلى قائمة كتب المستخدم
        const usersTransaction = db.transaction(['users'], 'readwrite');
        const usersStore = usersTransaction.objectStore('users');
        const getUserRequest = usersStore.get(currentUser.id);
        
        getUserRequest.onsuccess = (event) => {
            const user = event.target.result;
            if (!user) return;
            
            user.myBooks.push(newBook.id);
            const updateUserRequest = usersStore.put(user);
            
            updateUserRequest.onsuccess = () => {
                currentUser = user;
                books.push(newBook);
                
                // إعادة تعيين النموذج
                document.getElementById('addBookForm').reset();
                document.getElementById('bookCoverPreview').src = "/api/placeholder/100/100";
                document.getElementById('selectedFile').textContent = "";
                
                showToast('تمت الإضافة', 'تم إضافة الكتاب بنجاح', 'success');
                updateProfilePage();
            };
        };
    };
    
    addBookRequest.onerror = (event) => {
        console.error('Error adding book:', event.target.error);
        showToast('خطأ', 'حدث خطأ أثناء إضافة الكتاب', 'error');
    };
}

function handleAppSettings() {
    // حفظ إعدادات التطبيق
    darkMode = document.getElementById('darkModeToggle').checked;
    const language = document.getElementById('languageSelect').value;
    
    // حفظ الإعدادات في التخزين المحلي
    localStorage.setItem('darkMode', darkMode);
    localStorage.setItem('language', language);
    
    // تطبيق الإعدادات
    updateTheme();
    
    showToast('تم الحفظ', 'تم حفظ إعدادات التطبيق بنجاح', 'success');
}

function handleImagePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        // تحديد العنصر المناسب بناءً على هوية الحقل
        let previewElement;
        if (e.target.id === 'profileImage') {
            previewElement = document.getElementById('profilePreview');
        } else if (e.target.id === 'settingsProfileImage') {
            previewElement = document.getElementById('settingsProfilePreview');
        } else if (e.target.id === 'bookCover') {
            previewElement = document.getElementById('bookCoverPreview');
        }
        
        if (previewElement) {
            previewElement.src = event.target.result;
        }
    };
    reader.readAsDataURL(file);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('selectedFile').textContent = file.name;
}

// ============= وظائف عامة =============
function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('active');
}

function toggleDarkMode() {
    darkMode = !darkMode;
    updateTheme();
}

function updateTheme() {
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    // تحديث حالة مفتاح التبديل في الإعدادات
    document.getElementById('darkModeToggle').checked = darkMode;
    
    // حفظ الوضع في التخزين المحلي
    localStorage.setItem('darkMode', darkMode);
}

function changeTheme(theme) {
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
    
    // إزالة جميع فئات السمات
    document.body.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-orange', 'theme-pink', 'theme-teal');
    
    // إضافة فئة السمة المحددة
    document.body.classList.add(`theme-${theme}`);
    
    // حفظ السمة في التخزين المحلي
    localStorage.setItem('theme', theme);
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    if (tab === 'login') {
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.getElementById('registerForm').classList.add('active');
    }
}

function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate__animated animate__fadeInUp`;
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${getToastIcon(type)}"></i>
        </div>
        <div class="toast-content">
            <h4 class="toast-title">${title}</h4>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // إضافة مستمع لزر الإغلاق
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
        setTimeout(() => toastContainer.removeChild(toast), 300);
    });
    
    // إزالة تلقائية بعد 5 ثوان
    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-times-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function setupReaderUX() {
    const readerContent = document.getElementById('readerContent');
    const readerToolbar = document.querySelector('.reader-toolbar');
    
    let hideToolbarTimeout;
    
    readerContent.addEventListener('mousemove', () => {
        readerToolbar.style.opacity = '1';
        readerToolbar.style.visibility = 'visible';
        
        clearTimeout(hideToolbarTimeout);
        hideToolbarTimeout = setTimeout(() => {
            readerToolbar.style.opacity = '0';
            readerToolbar.style.visibility = 'hidden';
        }, 3000);
    });
    
    // إضافة التنقل بالأسهم
    document.addEventListener('keydown', (e) => {
        if (currentPage === 'reader') {
            if (e.key === 'ArrowRight') {
                changePage(-1);
            } else if (e.key === 'ArrowLeft') {
                changePage(1);
            }
        }
    });
}